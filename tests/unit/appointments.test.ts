import { describe, expect, it } from "vitest";
import {
  bookAppointmentSchema,
  doctorScheduleSchema,
  formatQueueNumber,
  rejectAppointmentSchema,
  rescheduleAppointmentSchema,
} from "@/features/appointments/schemas";
import {
  assertValidScheduleSlot,
  getQuotaStatus,
  InvalidBookingDateError,
  ScheduleOverlapError,
  schedulesOverlap,
  validateBookingDate,
} from "@/features/appointments/service";

describe("doctorScheduleSchema", () => {
  const validInput = {
    doctorId: "doc-1",
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "12:00",
    quota: 15,
  };

  it("menerima jadwal yang valid", () => {
    expect(doctorScheduleSchema.safeParse(validInput).success).toBe(true);
  });

  it("menolak jam selesai yang sama atau lebih awal dari jam mulai", () => {
    const equalTime = doctorScheduleSchema.safeParse({
      ...validInput,
      startTime: "09:00",
      endTime: "09:00",
    });
    expect(equalTime.success).toBe(false);

    const earlierTime = doctorScheduleSchema.safeParse({
      ...validInput,
      startTime: "10:00",
      endTime: "09:00",
    });
    expect(earlierTime.success).toBe(false);
  });

  it("menolak kuota kurang dari 1", () => {
    const zeroQuota = doctorScheduleSchema.safeParse({ ...validInput, quota: 0 });
    expect(zeroQuota.success).toBe(false);
  });

  it("menolak format jam yang tidak valid", () => {
    const badTime = doctorScheduleSchema.safeParse({ ...validInput, startTime: "25:99" });
    expect(badTime.success).toBe(false);
  });
});

describe("validasi tumpang tindih sesi jadwal", () => {
  const existing = [
    { id: "slot-1", startTime: "08:00", endTime: "11:00" },
    { id: "slot-2", startTime: "13:00", endTime: "16:00" },
  ];

  it("mendeteksi sesi yang tumpang tindih sebagian atau penuh", () => {
    expect(
      schedulesOverlap(
        { startTime: "10:00", endTime: "12:00" },
        { startTime: "08:00", endTime: "11:00" },
      ),
    ).toBe(true);

    expect(() =>
      assertValidScheduleSlot({ startTime: "09:00", endTime: "10:30", quota: 10 }, existing),
    ).toThrow(ScheduleOverlapError);
  });

  it("mengizinkan sesi yang bersebelahan tepat di jam pergantian", () => {
    expect(() =>
      assertValidScheduleSlot({ startTime: "11:00", endTime: "13:00", quota: 10 }, existing),
    ).not.toThrow();
  });

  it("mengabaikan sesi milik sendiri saat mode edit (excludeId)", () => {
    expect(() =>
      assertValidScheduleSlot(
        { startTime: "08:30", endTime: "11:30", quota: 12 },
        existing,
        "slot-1",
      ),
    ).not.toThrow();
  });
});

describe("validasi tanggal booking", () => {
  const today = "2026-11-20";

  it("menerima hari ini dan maksimal 30 hari ke depan", () => {
    expect(() => validateBookingDate("2026-11-20", today)).not.toThrow();
    expect(() => validateBookingDate("2026-12-20", today)).not.toThrow();
  });

  it("menolak tanggal lampau", () => {
    expect(() => validateBookingDate("2026-11-19", today)).toThrow(InvalidBookingDateError);
  });

  it("menolak tanggal lebih dari 30 hari ke depan", () => {
    expect(() => validateBookingDate("2026-12-21", today)).toThrow(InvalidBookingDateError);
  });

  it("menolak format tanggal yang tidak valid", () => {
    expect(() => validateBookingDate("20-11-2026", today)).toThrow(InvalidBookingDateError);
    expect(() => validateBookingDate("2026-02-30", today)).toThrow(InvalidBookingDateError);
  });
});

describe("indikator status kuota", () => {
  it("mengembalikan status Tersedia, Hampir Penuh, dan Penuh", () => {
    expect(getQuotaStatus(2, 10)).toEqual({
      remaining: 8,
      percentage: 20,
      status: "AVAILABLE",
      label: "Tersedia",
    });
    expect(getQuotaStatus(8, 10)).toEqual({
      remaining: 2,
      percentage: 80,
      status: "ALMOST_FULL",
      label: "Hampir Penuh",
    });
    expect(getQuotaStatus(10, 10)).toEqual({
      remaining: 0,
      percentage: 100,
      status: "FULL",
      label: "Penuh",
    });
  });
});

describe("bookAppointmentSchema", () => {
  it("memvalidasi keluhan minimal 3 karakter dan format tanggal", () => {
    expect(
      bookAppointmentSchema.safeParse({
        patientId: "pat-1",
        doctorId: "doc-1",
        scheduleId: "sch-1",
        appointmentDate: "2026-11-20",
        chiefComplaint: "Demam sejak kemarin",
      }).success,
    ).toBe(true);

    expect(
      bookAppointmentSchema.safeParse({
        patientId: "pat-1",
        doctorId: "doc-1",
        scheduleId: "sch-1",
        appointmentDate: "2026-11-20",
        chiefComplaint: "ab",
      }).success,
    ).toBe(false);
  });
});

describe("formatQueueNumber & rejectAppointmentSchema", () => {
  it("memformat nomor antrean menjadi format A-01, A-05, A-12", () => {
    expect(formatQueueNumber(1)).toBe("A-01");
    expect(formatQueueNumber(5)).toBe("A-05");
    expect(formatQueueNumber(15)).toBe("A-15");
    expect(formatQueueNumber(120)).toBe("A-120");
  });

  it("mewajibkan alasan penolakan minimal 5 karakter", () => {
    expect(
      rejectAppointmentSchema.safeParse({
        appointmentId: "app-1",
        reason: "Dok",
      }).success,
    ).toBe(false);

    expect(
      rejectAppointmentSchema.safeParse({
        appointmentId: "app-1",
        reason: "Dokter berhalangan hadir karena tugas luar",
      }).success,
    ).toBe(true);
  });
});

describe("rescheduleAppointmentSchema", () => {
  it("memvalidasi tanggal, sesi tujuan, dan alasan minimal 5 karakter", () => {
    expect(
      rescheduleAppointmentSchema.safeParse({
        appointmentId: "app-1",
        scheduleId: "sch-2",
        appointmentDate: "2026-11-23",
        reason: "Dok",
      }).success,
    ).toBe(false);

    expect(
      rescheduleAppointmentSchema.safeParse({
        appointmentId: "app-1",
        scheduleId: "sch-2",
        appointmentDate: "2026-11-23",
        reason: "Dokter berhalangan hadir pada tanggal awal",
      }).success,
    ).toBe(true);
  });
});
