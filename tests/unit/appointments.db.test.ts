import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { dayOfWeekFromDateStr } from "@/lib/date";
import { addFamilyMember, registerPatientAccount } from "@/features/patients/service";
import {
  bookAppointmentForPatient,
  cancelPatientAppointment,
  DuplicateAppointmentError,
  PatientNotOwnedError,
  QuotaFullError,
} from "@/features/appointments/service";
import { getAvailableSessionsForDate } from "@/features/appointments/queries";

async function clean() {
  await db.appointmentHistory.deleteMany();
  await db.prescriptionItem.deleteMany();
  await db.medicalRecord.deleteMany();
  await db.appointment.deleteMany();
  await db.doctorSchedule.deleteMany();
  await db.passwordResetToken.deleteMany();
  await db.patient.deleteMany();
  await db.user.deleteMany();
  await db.counter.deleteMany();
}

let seq = 0;
async function newPatientAccount() {
  seq += 1;
  return registerPatientAccount({
    name: `pasien booking ${seq}`,
    email: `booking${seq}@contoh.test`,
    phone: `08140000${String(seq).padStart(4, "0")}`,
    nik: "",
    birthDate: "1992-05-10",
    gender: "MALE",
    address: "",
    password: "rahasia123",
    confirmPassword: "rahasia123",
    consent: true,
  });
}

async function createDoctorAndSchedule(dateStr: string, quota: number) {
  seq += 1;
  const passwordHash = await bcrypt.hash("rahasia123", 4);
  const doctor = await db.user.create({
    data: {
      name: `dr. Uji ${seq}`,
      email: `dokter-uji-${seq}@contoh.test`,
      phone: `08150000${String(seq).padStart(4, "0")}`,
      passwordHash,
      role: "DOCTOR",
      isActive: true,
    },
  });
  const schedule = await db.doctorSchedule.create({
    data: {
      doctorId: doctor.id,
      dayOfWeek: dayOfWeekFromDateStr(dateStr),
      startTime: "08:00",
      endTime: "11:00",
      quota,
      isActive: true,
    },
  });
  return { doctor, schedule };
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("booking janji & kuota (database)", () => {
  const today = "2026-11-20";

  it("menahan balapan paralel sehingga slot terakhir tidak terisi ganda", async () => {
    const { doctor, schedule } = await createDoctorAndSchedule(today, 2);
    const accounts = await Promise.all([
      newPatientAccount(),
      newPatientAccount(),
      newPatientAccount(),
      newPatientAccount(),
      newPatientAccount(),
    ]);

    const results = await Promise.allSettled(
      accounts.map((acc) =>
        bookAppointmentForPatient(
          acc.user.id,
          {
            patientId: acc.patient.id,
            doctorId: doctor.id,
            scheduleId: schedule.id,
            appointmentDate: today,
            chiefComplaint: "Konsultasi paralel kuota terakhir",
          },
          today,
        ),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(3);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(QuotaFullError);
    }

    const totalRows = await db.appointment.count({ where: { scheduleId: schedule.id } });
    expect(totalRows).toBe(2);
  });

  it("menolak janji aktif ganda pada dokter dan hari yang sama", async () => {
    const { doctor, schedule } = await createDoctorAndSchedule(today, 5);
    const acc = await newPatientAccount();

    const created = await bookAppointmentForPatient(
      acc.user.id,
      {
        patientId: acc.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Demam tinggi",
      },
      today,
    );

    expect(created.status).toBe("PENDING");
    expect(created.queueNumber).toBeNull();

    const history = await db.appointmentHistory.findMany({ where: { appointmentId: created.id } });
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe("PENDING");
    expect(history[0]?.changedByUserId).toBe(acc.user.id);

    await expect(
      bookAppointmentForPatient(
        acc.user.id,
        {
          patientId: acc.patient.id,
          doctorId: doctor.id,
          scheduleId: schedule.id,
          appointmentDate: today,
          chiefComplaint: "Daftar ulang kedua",
        },
        today,
      ),
    ).rejects.toBeInstanceOf(DuplicateAppointmentError);
  });

  it("mengizinkan booking untuk anggota keluarga dan menolak pasien milik akun lain", async () => {
    const { doctor, schedule } = await createDoctorAndSchedule(today, 5);
    const akunA = await newPatientAccount();
    const akunB = await newPatientAccount();

    const childA = await addFamilyMember(akunA.user.id, {
      name: "Anak Akun A",
      relationship: "CHILD",
      birthDate: "2019-03-04",
      gender: "FEMALE",
    });

    const appChild = await bookAppointmentForPatient(
      akunA.user.id,
      {
        patientId: childA.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Batuk pilek anak",
      },
      today,
    );
    expect(appChild.patientId).toBe(childA.id);

    // Akun A tidak boleh membuatkan janji untuk pasien milik akun B
    await expect(
      bookAppointmentForPatient(
        akunA.user.id,
        {
          patientId: akunB.patient.id,
          doctorId: doctor.id,
          scheduleId: schedule.id,
          appointmentDate: today,
          chiefComplaint: "Coba akses akun lain",
        },
        today,
      ),
    ).rejects.toBeInstanceOf(PatientNotOwnedError);
  });

  it("pembatalan janji PENDING mengembalikan kuota dan mencatat riwayat", async () => {
    const { doctor, schedule } = await createDoctorAndSchedule(today, 1);
    const akunA = await newPatientAccount();
    const akunB = await newPatientAccount();

    const appA = await bookAppointmentForPatient(
      akunA.user.id,
      {
        patientId: akunA.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Keluhan pertama",
      },
      today,
    );

    let slots = await getAvailableSessionsForDate(doctor.id, today);
    expect(slots[0]?.remaining).toBe(0);
    expect(slots[0]?.quotaStatus).toBe("FULL");

    // Akun B tidak boleh membatalkan janji milik Akun A
    await expect(cancelPatientAppointment(akunB.user.id, appA.id)).rejects.toBeInstanceOf(
      PatientNotOwnedError,
    );

    await cancelPatientAppointment(akunA.user.id, appA.id);

    const updated = await db.appointment.findUniqueOrThrow({ where: { id: appA.id } });
    expect(updated.status).toBe("CANCELLED");

    const histories = await db.appointmentHistory.findMany({
      where: { appointmentId: appA.id },
      orderBy: { createdAt: "asc" },
    });
    expect(histories.map((h) => h.status)).toEqual(["PENDING", "CANCELLED"]);

    slots = await getAvailableSessionsForDate(doctor.id, today);
    expect(slots[0]?.remaining).toBe(1);
    expect(slots[0]?.quotaStatus).toBe("ALMOST_FULL");

    // Akun B sekarang bisa mengambil slot yang dibatalkan
    const appB = await bookAppointmentForPatient(
      akunB.user.id,
      {
        patientId: akunB.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Mengisi slot kosong",
      },
      today,
    );
    expect(appB.status).toBe("PENDING");
  });
});
