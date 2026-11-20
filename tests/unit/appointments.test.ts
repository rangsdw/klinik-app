import { describe, expect, it } from "vitest";
import { doctorScheduleSchema } from "@/features/appointments/schemas";
import {
  assertValidScheduleSlot,
  ScheduleOverlapError,
  schedulesOverlap,
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
