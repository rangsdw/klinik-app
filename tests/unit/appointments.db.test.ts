import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { dayOfWeekFromDateStr } from "@/lib/date";
import { addFamilyMember, registerPatientAccount } from "@/features/patients/service";
import {
  approveAppointmentByStaff,
  bookAppointmentForPatient,
  cancelPatientAppointment,
  DuplicateAppointmentError,
  InvalidAppointmentStateError,
  PatientNotOwnedError,
  QuotaFullError,
  rejectAppointmentByStaff,
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

  it("menerbitkan nomor antrean atomik unik per dokter per hari walau disetujui paralel", async () => {
    const { doctor: doctor1, schedule: schedule1 } = await createDoctorAndSchedule(today, 10);
    const { doctor: doctor2, schedule: schedule2 } = await createDoctorAndSchedule(today, 10);
    const staffHash = await bcrypt.hash("rahasia123", 4);
    const staff = await db.user.create({
      data: {
        name: "Staf Pendaftaran Uji",
        email: "staf-uji-queue@contoh.test",
        phone: "081600000001",
        passwordHash: staffHash,
        role: "STAFF",
        staffType: "REGISTRATION",
        isActive: true,
      },
    });

    const accounts = await Promise.all([
      newPatientAccount(),
      newPatientAccount(),
      newPatientAccount(),
      newPatientAccount(),
    ]);

    const appsDoc1 = await Promise.all(
      accounts.slice(0, 3).map((acc) =>
        bookAppointmentForPatient(
          acc.user.id,
          {
            patientId: acc.patient.id,
            doctorId: doctor1.id,
            scheduleId: schedule1.id,
            appointmentDate: today,
            chiefComplaint: "Keluhan antrean paralel",
          },
          today,
        ),
      ),
    );
    const appDoc2 = await bookAppointmentForPatient(
      accounts[3]!.user.id,
      {
        patientId: accounts[3]!.patient.id,
        doctorId: doctor2.id,
        scheduleId: schedule2.id,
        appointmentDate: today,
        chiefComplaint: "Dokter berbeda",
      },
      today,
    );

    const approvedDoc1 = await Promise.all(
      appsDoc1.map((app) => approveAppointmentByStaff(staff.id, app.id)),
    );
    const approvedDoc2 = await approveAppointmentByStaff(staff.id, appDoc2.id);

    expect(approvedDoc1.map((r) => r.queueNumber).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(approvedDoc2.queueNumber).toBe(1);
    expect(approvedDoc2.formattedQueueNumber).toBe("A-01");
  });

  it("mencegah proses ulang paralel oleh dua staf dan mengembalikan kuota saat REJECTED", async () => {
    const { doctor, schedule } = await createDoctorAndSchedule(today, 1);
    const accA = await newPatientAccount();
    const accB = await newPatientAccount();
    const staffHash = await bcrypt.hash("rahasia123", 4);

    const [staff1, staff2] = await Promise.all([
      db.user.create({
        data: {
          name: "Staf Satu",
          email: "staf-1-race@contoh.test",
          phone: "081600000011",
          passwordHash: staffHash,
          role: "STAFF",
          staffType: "REGISTRATION",
          isActive: true,
        },
      }),
      db.user.create({
        data: {
          name: "Staf Dua",
          email: "staf-2-race@contoh.test",
          phone: "081600000012",
          passwordHash: staffHash,
          role: "STAFF",
          staffType: "REGISTRATION",
          isActive: true,
        },
      }),
    ]);

    const pendingApp = await bookAppointmentForPatient(
      accA.user.id,
      {
        patientId: accA.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Cek balapan approve vs reject",
      },
      today,
    );

    // Dua staf memproses janji yang sama bersamaan -> tepat 1 berhasil, 1 ditolak
    const race = await Promise.allSettled([
      approveAppointmentByStaff(staff1.id, pendingApp.id),
      rejectAppointmentByStaff(staff2.id, {
        appointmentId: pendingApp.id,
        reason: "Dokter berhalangan hadir mendadak",
      }),
    ]);
    const okCount = race.filter((r) => r.status === "fulfilled").length;
    const errList = race.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(okCount).toBe(1);
    expect(errList).toHaveLength(1);
    expect(errList[0]?.reason).toBeInstanceOf(InvalidAppointmentStateError);

    // Uji alur reject bersih pada janji baru untuk memastikan kuota kembali & riwayat tercatat
    const { doctor: docReject, schedule: schReject } = await createDoctorAndSchedule(today, 1);
    const appReject = await bookAppointmentForPatient(
      accB.user.id,
      {
        patientId: accB.patient.id,
        doctorId: docReject.id,
        scheduleId: schReject.id,
        appointmentDate: today,
        chiefComplaint: "Akan ditolak staf",
      },
      today,
    );

    await rejectAppointmentByStaff(staff1.id, {
      appointmentId: appReject.id,
      reason: "Dokter sedang rapat dinas",
    });

    const row = await db.appointment.findUniqueOrThrow({ where: { id: appReject.id } });
    expect(row.status).toBe("REJECTED");
    expect(row.rejectionReason).toBe("Dokter sedang rapat dinas");
    expect(row.queueNumber).toBeNull();

    const histories = await db.appointmentHistory.findMany({
      where: { appointmentId: appReject.id },
      orderBy: { createdAt: "asc" },
    });
    expect(histories).toHaveLength(2);
    expect(histories[1]?.status).toBe("REJECTED");
    expect(histories[1]?.changedByUserId).toBe(staff1.id);

    // Kuota 1 kembali tersedia setelah REJECTED
    const slots = await getAvailableSessionsForDate(docReject.id, today);
    expect(slots[0]?.remaining).toBe(1);
    expect(slots[0]?.quotaStatus).toBe("ALMOST_FULL");

    const rebooked = await bookAppointmentForPatient(
      accA.user.id,
      {
        patientId: accA.patient.id,
        doctorId: docReject.id,
        scheduleId: schReject.id,
        appointmentDate: today,
        chiefComplaint: "Booking ulang setelah slot kembali",
      },
      today,
    );
    expect(rebooked.status).toBe("PENDING");
  });
});
