import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { dayOfWeekFromDateStr } from "@/lib/date";
import { registerPatientAccount } from "@/features/patients/service";
import {
  approveAppointmentByStaff,
  bookAppointmentForPatient,
  DuplicateAppointmentError,
  DuplicatePatientError,
  InvalidBookingDateError,
  registerWalkInAppointment,
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
    name: `pasien online ${seq}`,
    email: `walkin-online-${seq}@contoh.test`,
    phone: `08190000${String(seq).padStart(4, "0")}`,
    nik: "",
    birthDate: "1990-06-15",
    gender: "MALE",
    address: "",
    password: "rahasia123",
    confirmPassword: "rahasia123",
    consent: true,
  });
}

async function createStaffAndDoctor(dateStr: string, quota = 1) {
  seq += 1;
  const hash = await bcrypt.hash("rahasia123", 4);
  const [staff, doctor] = await Promise.all([
    db.user.create({
      data: {
        name: `Staf Walkin ${seq}`,
        email: `staf-wi-${seq}@contoh.test`,
        phone: `08191001${String(seq).padStart(4, "0")}`,
        passwordHash: hash,
        role: "STAFF",
        staffType: "REGISTRATION",
        isActive: true,
      },
    }),
    db.user.create({
      data: {
        name: `dr. Walkin ${seq}`,
        email: `dokter-wi-${seq}@contoh.test`,
        phone: `08191002${String(seq).padStart(4, "0")}`,
        passwordHash: hash,
        role: "DOCTOR",
        isActive: true,
      },
    }),
  ]);

  const schedule = await db.doctorSchedule.create({
    data: {
      doctorId: doctor.id,
      dayOfWeek: dayOfWeekFromDateStr(dateStr),
      startTime: "08:00",
      endTime: "12:00",
      quota,
      isActive: true,
    },
  });

  return { staff, doctor, schedule };
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("antrean walk-in (database)", () => {
  const today = "2026-11-22";

  it("mendaftarkan pasien baru tanpa akun portal dan langsung memberi nomor antrean + check-in", async () => {
    const { staff, doctor, schedule } = await createStaffAndDoctor(today, 1);

    const res = await registerWalkInAppointment(
      staff.id,
      {
        mode: "NEW",
        doctorId: doctor.id,
        scheduleId: schedule.id,
        chiefComplaint: "Demam tinggi dan batuk",
        newPatient: {
          name: "andi walkin baru",
          birthDate: "1995-08-17",
          gender: "MALE",
          nik: "3201010101950001",
          phone: "081234567890",
          bloodType: "A",
          address: "Jl. Merpati 10",
          allergies: "",
          specialConditions: "",
        },
      },
      today,
      "09:00",
    );

    expect(res.isNewPatient).toBe(true);
    expect(res.formattedQueueNumber).toBe("A-01");
    expect(res.newPatientQrToken).toHaveLength(36);

    const patientRow = await db.patient.findUniqueOrThrow({ where: { id: res.patientId } });
    expect(patientRow.accountUserId).toBeNull();
    expect(patientRow.createdByUserId).toBe(staff.id);
    expect(patientRow.relationship).toBe("OTHER");
    expect(patientRow.isSelf).toBe(false);
    expect(patientRow.name).toBe("Andi Walkin Baru");

    const apptRow = await db.appointment.findUniqueOrThrow({ where: { id: res.appointmentId } });
    expect(apptRow.source).toBe("WALK_IN");
    expect(apptRow.status).toBe("CONFIRMED");
    expect(apptRow.checkedInAt).not.toBeNull();
    expect(apptRow.checkedInByUserId).toBe(staff.id);

    // Walk-in tidak mengurangi kuota booking online
    const slots = await getAvailableSessionsForDate(doctor.id, today);
    expect(slots[0]?.remaining).toBe(1);
  });

  it("mencegah duplikat pasien baru (NIK sama atau nama+tanggal lahir+HP sama) dan janji ganda", async () => {
    const { staff, doctor, schedule } = await createStaffAndDoctor(today, 5);

    const first = await registerWalkInAppointment(
      staff.id,
      {
        mode: "NEW",
        doctorId: doctor.id,
        scheduleId: schedule.id,
        chiefComplaint: "Pemeriksaan awal",
        newPatient: {
          name: "siti rahma",
          birthDate: "1993-02-10",
          gender: "FEMALE",
          nik: "3201010101930002",
          phone: "081299998888",
          bloodType: "",
          address: "",
          allergies: "",
          specialConditions: "",
        },
      },
      today,
      "09:00",
    );

    // Duplikat NIK saat coba daftar baru lagi
    await expect(
      registerWalkInAppointment(
        staff.id,
        {
          mode: "NEW",
          doctorId: doctor.id,
          scheduleId: schedule.id,
          chiefComplaint: "Daftar kedua",
          newPatient: {
            name: "siti lain",
            birthDate: "1993-02-10",
            gender: "FEMALE",
            nik: "3201010101930002",
            phone: "",
            bloodType: "",
            address: "",
            allergies: "",
            specialConditions: "",
          },
        },
        today,
        "09:05",
      ),
    ).rejects.toBeInstanceOf(DuplicatePatientError);

    // Duplikat janji aktif pasien lama pada dokter dan hari yang sama
    await expect(
      registerWalkInAppointment(
        staff.id,
        {
          mode: "EXISTING",
          patientId: first.patientId,
          doctorId: doctor.id,
          scheduleId: schedule.id,
          chiefComplaint: "Daftar ulang dokter sama",
        },
        today,
        "09:10",
      ),
    ).rejects.toBeInstanceOf(DuplicateAppointmentError);
  });

  it("menolak pendaftaran walk-in pada sesi yang sudah berakhir", async () => {
    const { staff, doctor, schedule } = await createStaffAndDoctor(today, 5);
    const acc = await newPatientAccount();

    await expect(
      registerWalkInAppointment(
        staff.id,
        {
          mode: "EXISTING",
          patientId: acc.patient.id,
          doctorId: doctor.id,
          scheduleId: schedule.id,
          chiefComplaint: "Datang terlambat",
        },
        today,
        "12:30",
      ),
    ).rejects.toBeInstanceOf(InvalidBookingDateError);
  });

  it("nomor antrean unik berurutan saat approve online dan walk-in berjalan paralel", async () => {
    const { staff, doctor, schedule } = await createStaffAndDoctor(today, 5);
    const [accOnline1, accOnline2, accWalkIn] = await Promise.all([
      newPatientAccount(),
      newPatientAccount(),
      newPatientAccount(),
    ]);

    const [online1, online2] = await Promise.all([
      bookAppointmentForPatient(
        accOnline1.user.id,
        {
          patientId: accOnline1.patient.id,
          doctorId: doctor.id,
          scheduleId: schedule.id,
          appointmentDate: today,
          chiefComplaint: "Online 1",
        },
        today,
      ),
      bookAppointmentForPatient(
        accOnline2.user.id,
        {
          patientId: accOnline2.patient.id,
          doctorId: doctor.id,
          scheduleId: schedule.id,
          appointmentDate: today,
          chiefComplaint: "Online 2",
        },
        today,
      ),
    ]);

    const [res1, res2, resWi] = await Promise.all([
      approveAppointmentByStaff(staff.id, online1.id),
      approveAppointmentByStaff(staff.id, online2.id),
      registerWalkInAppointment(
        staff.id,
        {
          mode: "EXISTING",
          patientId: accWalkIn.patient.id,
          doctorId: doctor.id,
          scheduleId: schedule.id,
          chiefComplaint: "Walk-in paralel",
        },
        today,
        "09:00",
      ),
    ]);

    const queues = [res1.queueNumber, res2.queueNumber, resWi.queueNumber].sort((a, b) => a - b);
    expect(queues).toEqual([1, 2, 3]);
  });
});
