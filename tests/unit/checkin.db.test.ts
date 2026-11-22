import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDaysToDateStr, dayOfWeekFromDateStr } from "@/lib/date";
import { registerPatientAccount } from "@/features/patients/service";
import { findPatientByQrTokenForStaff } from "@/features/patients/staff-queries";
import {
  approveAppointmentByStaff,
  bookAppointmentForPatient,
  InvalidAppointmentStateError,
  lookupPatientCheckInToday,
  performAppointmentCheckIn,
  rejectAppointmentByStaff,
} from "@/features/appointments/service";

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
    name: `pasien checkin ${seq}`,
    email: `checkin${seq}@contoh.test`,
    phone: `08170000${String(seq).padStart(4, "0")}`,
    nik: "",
    birthDate: "1991-04-12",
    gender: "FEMALE",
    address: "",
    password: "rahasia123",
    confirmPassword: "rahasia123",
    consent: true,
  });
}

async function createStaffAndDoctor(dateStr: string) {
  seq += 1;
  const hash = await bcrypt.hash("rahasia123", 4);
  const [staff1, staff2, doctor] = await Promise.all([
    db.user.create({
      data: {
        name: `Staf A ${seq}`,
        email: `staf-ci-a-${seq}@contoh.test`,
        phone: `08180001${String(seq).padStart(4, "0")}`,
        passwordHash: hash,
        role: "STAFF",
        staffType: "REGISTRATION",
        isActive: true,
      },
    }),
    db.user.create({
      data: {
        name: `Staf B ${seq}`,
        email: `staf-ci-b-${seq}@contoh.test`,
        phone: `08180002${String(seq).padStart(4, "0")}`,
        passwordHash: hash,
        role: "STAFF",
        staffType: "REGISTRATION",
        isActive: true,
      },
    }),
    db.user.create({
      data: {
        name: `dr. Checkin ${seq}`,
        email: `dokter-ci-${seq}@contoh.test`,
        phone: `08180003${String(seq).padStart(4, "0")}`,
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
      quota: 10,
      isActive: true,
    },
  });

  return { staff1, staff2, doctor, schedule };
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("check-in oleh staf (database)", () => {
  const today = "2026-11-22";

  it("findPatientByQrTokenForStaff hanya mengembalikan field minimum dan menolak pasien soft-delete", async () => {
    const acc = await newPatientAccount();
    await db.patient.update({
      where: { id: acc.patient.id },
      data: { allergies: "Penisilin", specialConditions: "Asma" },
    });

    const row = await db.patient.findUniqueOrThrow({ where: { id: acc.patient.id } });
    const summary = await findPatientByQrTokenForStaff(row.qrToken);

    expect(summary).not.toBeNull();
    expect(Object.keys(summary!).sort()).toEqual(["ageLabel", "id", "medicalRecordNumber", "name"]);
    expect(summary).not.toHaveProperty("allergies");
    expect(summary).not.toHaveProperty("specialConditions");
    expect(summary).not.toHaveProperty("qrToken");

    await db.patient.update({ where: { id: acc.patient.id }, data: { deletedAt: new Date() } });
    expect(await findPatientByQrTokenForStaff(row.qrToken)).toBeNull();
  });

  it("mencatat check-in janji CONFIRMED hari ini, menolak PENDING, bukan hari ini, dan REJECTED", async () => {
    const acc = await newPatientAccount();
    const tomorrow = addDaysToDateStr(today, 1);
    const { staff1, doctor, schedule } = await createStaffAndDoctor(today);
    const tomorrowSchedule = await db.doctorSchedule.create({
      data: {
        doctorId: doctor.id,
        dayOfWeek: dayOfWeekFromDateStr(tomorrow),
        startTime: "08:00",
        endTime: "11:00",
        quota: 10,
        isActive: true,
      },
    });

    // 1. Janji PENDING -> ditolak check-in
    const pendingApp = await bookAppointmentForPatient(
      acc.user.id,
      {
        patientId: acc.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Keluhan hari ini",
      },
      today,
    );

    await expect(
      performAppointmentCheckIn(staff1.id, { appointmentId: pendingApp.id, method: "QR" }, today),
    ).rejects.toThrow("Janji belum disetujui.");

    // 2. Setujui -> check-in berhasil & tulis riwayat
    await approveAppointmentByStaff(staff1.id, pendingApp.id);
    const ci = await performAppointmentCheckIn(
      staff1.id,
      { appointmentId: pendingApp.id, method: "QR" },
      today,
    );
    expect(ci.alreadyCheckedIn).toBe(false);
    expect(ci.formattedQueueNumber).toBe("A-01");

    const updated = await db.appointment.findUniqueOrThrow({ where: { id: pendingApp.id } });
    expect(updated.status).toBe("CONFIRMED");
    expect(updated.checkedInAt).not.toBeNull();
    expect(updated.checkedInByUserId).toBe(staff1.id);

    const histories = await db.appointmentHistory.findMany({
      where: { appointmentId: pendingApp.id },
      orderBy: { createdAt: "asc" },
    });
    expect(histories).toHaveLength(3);
    expect(histories[2]?.notes).toContain("QR Code");
    expect(histories[2]?.changedByUserId).toBe(staff1.id);

    // 3. Janji besok yang sudah disetujui -> ditolak karena bukan hari ini
    const tomorrowApp = await bookAppointmentForPatient(
      acc.user.id,
      {
        patientId: acc.patient.id,
        doctorId: doctor.id,
        scheduleId: tomorrowSchedule.id,
        appointmentDate: tomorrow,
        chiefComplaint: "Janji besok",
      },
      today,
    );
    await approveAppointmentByStaff(staff1.id, tomorrowApp.id);
    await expect(
      performAppointmentCheckIn(
        staff1.id,
        { appointmentId: tomorrowApp.id, method: "MANUAL" },
        today,
      ),
    ).rejects.toBeInstanceOf(InvalidAppointmentStateError);

    // 4. Janji REJECTED -> ditolak
    const acc2 = await newPatientAccount();
    const rejectedApp = await bookAppointmentForPatient(
      acc2.user.id,
      {
        patientId: acc2.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Akan ditolak",
      },
      today,
    );
    await rejectAppointmentByStaff(staff1.id, {
      appointmentId: rejectedApp.id,
      reason: "Dokter berhalangan",
    });
    await expect(
      performAppointmentCheckIn(
        staff1.id,
        { appointmentId: rejectedApp.id, method: "MANUAL" },
        today,
      ),
    ).rejects.toBeInstanceOf(InvalidAppointmentStateError);
  });

  it("check-in paralel oleh dua staf aman, idempoten, dan mendukung banyak janji hari ini", async () => {
    const acc = await newPatientAccount();
    const { staff1, staff2, doctor: doc1, schedule: sch1 } = await createStaffAndDoctor(today);
    const { doctor: doc2, schedule: sch2 } = await createStaffAndDoctor(today);

    const [app1, app2] = await Promise.all([
      bookAppointmentForPatient(
        acc.user.id,
        {
          patientId: acc.patient.id,
          doctorId: doc1.id,
          scheduleId: sch1.id,
          appointmentDate: today,
          chiefComplaint: "Poli A",
        },
        today,
      ),
      bookAppointmentForPatient(
        acc.user.id,
        {
          patientId: acc.patient.id,
          doctorId: doc2.id,
          scheduleId: sch2.id,
          appointmentDate: today,
          chiefComplaint: "Poli B",
        },
        today,
      ),
    ]);

    await Promise.all([
      approveAppointmentByStaff(staff1.id, app1.id),
      approveAppointmentByStaff(staff1.id, app2.id),
    ]);

    // Pasien memiliki 2 janji CONFIRMED hari ini -> keduanya muncul
    const lookup = await lookupPatientCheckInToday(acc.patient.id, "QR", today);
    expect(lookup?.eligibleConfirmed).toHaveLength(2);

    // Dua staf check-in janji app1 bersamaan -> 1 baru, 1 alreadyCheckedIn, hanya 1 riwayat check-in
    const [r1, r2] = await Promise.all([
      performAppointmentCheckIn(staff1.id, { appointmentId: app1.id, method: "QR" }, today),
      performAppointmentCheckIn(staff2.id, { appointmentId: app1.id, method: "MANUAL" }, today),
    ]);

    expect([r1.alreadyCheckedIn, r2.alreadyCheckedIn].sort()).toEqual([false, true]);
    expect(r1.checkedInAt.getTime()).toBe(r2.checkedInAt.getTime());

    const histories = await db.appointmentHistory.findMany({
      where: { appointmentId: app1.id, notes: { contains: "Check-in berhasil" } },
    });
    expect(histories).toHaveLength(1);
  });
});
