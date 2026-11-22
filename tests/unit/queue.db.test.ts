import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { dayOfWeekFromDateStr, parseDateOnlyUtc } from "@/lib/date";
import { registerPatientAccount } from "@/features/patients/service";
import {
  approveAppointmentByStaff,
  bookAppointmentForPatient,
  callNextQueueByStaff,
  InvalidAppointmentStateError,
  markAppointmentNoShowByStaff,
  performAppointmentCheckIn,
  recallQueueByStaff,
} from "@/features/appointments/service";
import {
  getDoctorQueue,
  getPatientLiveQueueData,
  getStaffQueueBoardData,
} from "@/features/appointments/queries";

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
async function newPatientAccount(label: string) {
  seq += 1;
  return registerPatientAccount({
    name: `${label} ${seq}`,
    email: `queue-${seq}@contoh.test`,
    phone: `08160000${String(seq).padStart(4, "0")}`,
    nik: "",
    birthDate: "1992-05-10",
    gender: "MALE",
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
        name: `Staf Q1 ${seq}`,
        email: `staf-q1-${seq}@contoh.test`,
        phone: `08161001${String(seq).padStart(4, "0")}`,
        passwordHash: hash,
        role: "STAFF",
        staffType: "REGISTRATION",
        isActive: true,
      },
    }),
    db.user.create({
      data: {
        name: `Staf Q2 ${seq}`,
        email: `staf-q2-${seq}@contoh.test`,
        phone: `08161002${String(seq).padStart(4, "0")}`,
        passwordHash: hash,
        role: "STAFF",
        staffType: "REGISTRATION",
        isActive: true,
      },
    }),
    db.user.create({
      data: {
        name: `dr. Antrean ${seq}`,
        email: `dokter-q-${seq}@contoh.test`,
        phone: `08161003${String(seq).padStart(4, "0")}`,
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
      quota: 20,
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

describe("live queue & papan antrean staf (database)", () => {
  const today = "2026-11-22";

  it("getDoctorQueue menghitung status tampilan, Antrean Sekarang (IN_PROGRESS vs calledAt), dan statistik", async () => {
    const { staff1, doctor, schedule } = await createStaffAndDoctor(today);
    const [acc1, acc2, acc3, acc4] = await Promise.all([
      newPatientAccount("pasien pertama"),
      newPatientAccount("pasien kedua"),
      newPatientAccount("pasien ketiga"),
      newPatientAccount("pasien keempat"),
    ]);

    const apps = [];
    for (const acc of [acc1, acc2, acc3, acc4]) {
      const app = await bookAppointmentForPatient(
        acc.user.id,
        {
          patientId: acc.patient.id,
          doctorId: doctor.id,
          scheduleId: schedule.id,
          appointmentDate: today,
          chiefComplaint: `Keluhan ${acc.patient.name}`,
        },
        today,
      );
      await approveAppointmentByStaff(staff1.id, app.id);
      apps.push(app);
    }

    // Awalnya belum ada yang check-in -> Antrean Sekarang null
    let snapshot = await getDoctorQueue(doctor.id, today);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.formattedCurrentQueueNumber).toBeNull();
    expect(snapshot?.items.map((i) => i.displayStatus)).toEqual([
      "NOT_ARRIVED",
      "NOT_ARRIVED",
      "NOT_ARRIVED",
      "NOT_ARRIVED",
    ]);

    // Check-in pasien 1, 2, 3 (pasien 4 tetap Belum datang)
    await performAppointmentCheckIn(staff1.id, { appointmentId: apps[0]!.id, method: "QR" }, today);
    await performAppointmentCheckIn(staff1.id, { appointmentId: apps[1]!.id, method: "QR" }, today);
    await performAppointmentCheckIn(staff1.id, { appointmentId: apps[2]!.id, method: "QR" }, today);

    // Panggil berikutnya -> A-01 dipanggil, status DB tetap CONFIRMED
    const called1 = await callNextQueueByStaff(staff1.id, doctor.id, today);
    expect(called1.formattedQueueNumber).toBe("A-01");

    const appt1Row = await db.appointment.findUniqueOrThrow({ where: { id: apps[0]!.id } });
    expect(appt1Row.status).toBe("CONFIRMED");
    expect(appt1Row.calledAt).not.toBeNull();

    // Panggil berikutnya -> A-02 dipanggil (calledAt terbaru)
    await new Promise((r) => setTimeout(r, 15));
    const called2 = await callNextQueueByStaff(staff1.id, doctor.id, today);
    expect(called2.formattedQueueNumber).toBe("A-02");

    snapshot = await getDoctorQueue(doctor.id, today);
    expect(snapshot?.formattedCurrentQueueNumber).toBe("A-02");
    expect(snapshot?.items.map((i) => i.displayStatus)).toEqual([
      "CALLED",
      "CALLED",
      "WAITING",
      "NOT_ARRIVED",
    ]);

    // Bila modul dokter menyetel A-01 menjadi IN_PROGRESS, A-01 menjadi Antrean Sekarang
    await db.appointment.update({
      where: { id: apps[0]!.id },
      data: { status: "IN_PROGRESS" },
    });

    snapshot = await getDoctorQueue(doctor.id, today);
    expect(snapshot?.formattedCurrentQueueNumber).toBe("A-01");
    expect(snapshot?.stats).toEqual({
      waiting: 1,
      called: 1,
      inService: 1,
      calledOrInService: 2,
      completed: 0,
      walkIn: 0,
      noShow: 0,
      notArrived: 1,
      total: 4,
    });

    // Tandai Tidak Hadir & Panggil Ulang
    await markAppointmentNoShowByStaff(staff1.id, apps[3]!.id, today);
    await db.appointment.update({
      where: { id: apps[0]!.id },
      data: { status: "COMPLETED" },
    });

    await new Promise((r) => setTimeout(r, 15));
    await recallQueueByStaff(staff1.id, apps[1]!.id, today);

    const board = await getStaffQueueBoardData(today);
    const docSnap = board.doctors.find((d) => d.doctorId === doctor.id);
    expect(docSnap?.formattedCurrentQueueNumber).toBe("A-02");
    expect(docSnap?.stats.completed).toBe(1);
    expect(docSnap?.stats.noShow).toBe(1);
    expect(board.totals.completed).toBe(1);
    expect(board.totals.noShow).toBe(1);
  });

  it("panggil berikutnya aman dari panggilan paralel dua staf (tidak memanggil pasien yang sama dua kali)", async () => {
    const { staff1, staff2, doctor, schedule } = await createStaffAndDoctor(today);
    const [acc1, acc2] = await Promise.all([
      newPatientAccount("paralel satu"),
      newPatientAccount("paralel dua"),
    ]);

    const app1 = await bookAppointmentForPatient(
      acc1.user.id,
      {
        patientId: acc1.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Antre 1",
      },
      today,
    );
    const app2 = await bookAppointmentForPatient(
      acc2.user.id,
      {
        patientId: acc2.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Antre 2",
      },
      today,
    );

    await approveAppointmentByStaff(staff1.id, app1.id);
    await approveAppointmentByStaff(staff1.id, app2.id);
    await performAppointmentCheckIn(staff1.id, { appointmentId: app1.id, method: "QR" }, today);
    await performAppointmentCheckIn(staff1.id, { appointmentId: app2.id, method: "QR" }, today);

    // Dua staf klik Panggil Berikutnya bersamaan -> memanggil A-01 dan A-02 secara terpisah
    const [c1, c2] = await Promise.all([
      callNextQueueByStaff(staff1.id, doctor.id, today),
      callNextQueueByStaff(staff2.id, doctor.id, today),
    ]);
    expect([c1.formattedQueueNumber, c2.formattedQueueNumber].sort()).toEqual(["A-01", "A-02"]);

    // Panggil ketiga ketika sudah kosong -> ditolak bersih
    await expect(callNextQueueByStaff(staff1.id, doctor.id, today)).rejects.toBeInstanceOf(
      InvalidAppointmentStateError,
    );
  });

  it("menolak markNoShow pada janji IN_PROGRESS / COMPLETED", async () => {
    const { staff1, doctor, schedule } = await createStaffAndDoctor(today);
    const acc = await newPatientAccount("sedang diperiksa");
    const app = await bookAppointmentForPatient(
      acc.user.id,
      {
        patientId: acc.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Cek proteksi status dokter",
      },
      today,
    );
    await approveAppointmentByStaff(staff1.id, app.id);
    await db.appointment.update({ where: { id: app.id }, data: { status: "IN_PROGRESS" } });

    await expect(markAppointmentNoShowByStaff(staff1.id, app.id, today)).rejects.toBeInstanceOf(
      InvalidAppointmentStateError,
    );
  });

  it("PRIVASI: getPatientLiveQueueData tidak pernah membocorkan nama, ID, atau No. RM pasien lain", async () => {
    const { staff1, doctor, schedule } = await createStaffAndDoctor(today);
    const [accOtherCalled, accOtherWaiting, accSelf] = await Promise.all([
      newPatientAccount("Rahasia Pasien Dipanggil"),
      newPatientAccount("Rahasia Pasien Menunggu"),
      newPatientAccount("Akun Sendiri"),
    ]);

    const appCalled = await bookAppointmentForPatient(
      accOtherCalled.user.id,
      {
        patientId: accOtherCalled.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Keluhan rahasia 1",
      },
      today,
    );
    const appWaiting = await bookAppointmentForPatient(
      accOtherWaiting.user.id,
      {
        patientId: accOtherWaiting.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Keluhan rahasia 2",
      },
      today,
    );
    const appSelf = await bookAppointmentForPatient(
      accSelf.user.id,
      {
        patientId: accSelf.patient.id,
        doctorId: doctor.id,
        scheduleId: schedule.id,
        appointmentDate: today,
        chiefComplaint: "Keluhan akun sendiri",
      },
      today,
    );

    await approveAppointmentByStaff(staff1.id, appCalled.id);
    await approveAppointmentByStaff(staff1.id, appWaiting.id);
    await approveAppointmentByStaff(staff1.id, appSelf.id);

    await performAppointmentCheckIn(
      staff1.id,
      { appointmentId: appCalled.id, method: "QR" },
      today,
    );
    await performAppointmentCheckIn(
      staff1.id,
      { appointmentId: appWaiting.id, method: "QR" },
      today,
    );
    await performAppointmentCheckIn(staff1.id, { appointmentId: appSelf.id, method: "QR" }, today);

    // Panggil A-01 (accOtherCalled) -> accOtherWaiting (A-02) menunggu, accSelf (A-03) menunggu di belakang 1 orang
    await callNextQueueByStaff(staff1.id, doctor.id, today);

    const payload = await getPatientLiveQueueData(accSelf.user.id, today);
    expect(payload.items).toHaveLength(1);
    const item = payload.items[0]!;
    expect(item.formattedQueueNumber).toBe("A-03");
    expect(item.formattedCurrentQueueNumber).toBe("A-01");
    expect(item.aheadCount).toBe(1);
    expect(item.displayStatus).toBe("WAITING");

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(accOtherCalled.patient.name);
    expect(serialized).not.toContain(accOtherCalled.patient.id);
    expect(serialized).not.toContain(accOtherCalled.patient.medicalRecordNumber);
    expect(serialized).not.toContain(accOtherWaiting.patient.name);
    expect(serialized).not.toContain(accOtherWaiting.patient.id);
    expect(serialized).not.toContain(accOtherWaiting.patient.medicalRecordNumber);
    expect(serialized).not.toContain(appCalled.id);
    expect(serialized).not.toContain(appWaiting.id);

    // Cek juga kondisi tanggal yang valid UTC date match
    const rawCount = await db.appointment.count({
      where: { doctorId: doctor.id, appointmentDate: parseDateOnlyUtc(today) },
    });
    expect(rawCount).toBe(3);
  });
});
