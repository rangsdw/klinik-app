import "server-only";
import { db } from "@/lib/db";
import {
  addDaysToDateStr,
  dayOfWeekFromDateStr,
  jakartaTodayStr,
  parseDateOnlyUtc,
} from "@/lib/date";
import { getOwnedPatient } from "@/features/patients/queries";
import {
  ACTIVE_QUOTA_STATUSES,
  DATE_REGEX,
  MAX_BOOKING_DAYS_AHEAD,
  type BookAppointmentInput,
} from "@/features/appointments/schemas";

export type TimeSlot = {
  id?: string;
  startTime: string;
  endTime: string;
};

export class ScheduleOverlapError extends Error {
  constructor(message = "Sesi tumpang tindih dengan jadwal aktif lain pada dokter dan hari yang sama.") {
    super(message);
    this.name = "ScheduleOverlapError";
  }
}

export class QuotaFullError extends Error {
  constructor(message = "Kuota sesi ini sudah penuh.") {
    super(message);
    this.name = "QuotaFullError";
  }
}

export class DuplicateAppointmentError extends Error {
  constructor(message = "Pasien sudah memiliki janji aktif pada dokter dan tanggal tersebut.") {
    super(message);
    this.name = "DuplicateAppointmentError";
  }
}

export class InvalidBookingDateError extends Error {
  constructor(message = "Tanggal janji tidak valid.") {
    super(message);
    this.name = "InvalidBookingDateError";
  }
}

export class PatientNotOwnedError extends Error {
  constructor(message = "Pasien tidak ditemukan.") {
    super(message);
    this.name = "PatientNotOwnedError";
  }
}

export class InvalidAppointmentStateError extends Error {
  constructor(message = "Status janji tidak dapat diubah.") {
    super(message);
    this.name = "InvalidAppointmentStateError";
  }
}

/** Ubah "HH:mm" menjadi total menit sejak 00:00. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Dua sesi tumpang tindih jika interval [start, end) saling beririsan. */
export function schedulesOverlap(a: TimeSlot, b: TimeSlot): boolean {
  const startA = timeToMinutes(a.startTime);
  const endA = timeToMinutes(a.endTime);
  const startB = timeToMinutes(b.startTime);
  const endB = timeToMinutes(b.endTime);
  return startA < endB && startB < endA;
}

/** Cari slot yang bentrok dengan input; kembalikan slot pertama yang bentrok atau null. */
export function findOverlappingSlot<T extends TimeSlot>(
  input: TimeSlot,
  existingSlots: T[],
  excludeId?: string,
): T | null {
  for (const slot of existingSlots) {
    if (excludeId && slot.id === excludeId) continue;
    if (schedulesOverlap(input, slot)) return slot;
  }
  return null;
}

/**
 * Validasi aturan bisnis sesi jadwal di server/service:
 * - Jam selesai harus setelah jam mulai
 * - Kuota minimal 1
 * - Tidak tumpang tindih dengan sesi lain pada dokter dan hari yang sama
 */
export function assertValidScheduleSlot(
  input: { startTime: string; endTime: string; quota: number },
  existingSlots: TimeSlot[],
  excludeId?: string,
): void {
  if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
    throw new Error("Jam selesai harus setelah jam mulai.");
  }
  if (!Number.isInteger(input.quota) || input.quota < 1) {
    throw new Error("Kuota minimal 1 pasien.");
  }
  const conflict = findOverlappingSlot(input, existingSlots, excludeId);
  if (conflict) {
    throw new ScheduleOverlapError(
      `Bentrok dengan sesi ${conflict.startTime}–${conflict.endTime} pada dokter dan hari yang sama.`,
    );
  }
}

/** Validasi tanggal booking: format YYYY-MM-DD, tidak lampau, maksimal 30 hari ke depan. */
export function validateBookingDate(dateStr: string, todayStr: string = jakartaTodayStr()): void {
  if (!DATE_REGEX.test(dateStr)) {
    throw new InvalidBookingDateError("Format tanggal tidak valid.");
  }
  const parsed = parseDateOnlyUtc(dateStr);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateStr) {
    throw new InvalidBookingDateError("Tanggal janji tidak valid.");
  }
  if (dateStr < todayStr) {
    throw new InvalidBookingDateError("Tanggal janji tidak boleh di masa lalu.");
  }
  const maxDate = addDaysToDateStr(todayStr, MAX_BOOKING_DAYS_AHEAD);
  if (dateStr > maxDate) {
    throw new InvalidBookingDateError(
      `Janji temu hanya dapat dibuat maksimal ${MAX_BOOKING_DAYS_AHEAD} hari ke depan.`,
    );
  }
}

export type QuotaStatusSummary = {
  remaining: number;
  percentage: number;
  status: "AVAILABLE" | "ALMOST_FULL" | "FULL";
  label: "Tersedia" | "Hampir Penuh" | "Penuh";
};

/** Hitung ringkasan sisa kuota dan status ketersediaan sesi. */
export function getQuotaStatus(used: number, quota: number): QuotaStatusSummary {
  const safeQuota = Math.max(0, quota);
  const safeUsed = Math.max(0, used);
  const remaining = Math.max(0, safeQuota - safeUsed);
  const percentage = safeQuota > 0 ? Math.min(100, Math.round((safeUsed / safeQuota) * 100)) : 100;

  if (remaining === 0) {
    return { remaining, percentage, status: "FULL", label: "Penuh" };
  }
  const lowThreshold = Math.max(2, Math.ceil(safeQuota * 0.2));
  if (remaining <= lowThreshold) {
    return { remaining, percentage, status: "ALMOST_FULL", label: "Hampir Penuh" };
  }
  return { remaining, percentage, status: "AVAILABLE", label: "Tersedia" };
}

/**
 * Buat janji temu pasien dengan pengecekan kepemilikan pasien, tanggal, kuota, dan duplikasi
 * di dalam satu transaksi terkunci (FOR UPDATE pada doctor_schedules) agar aman dari balapan paralel.
 */
export async function bookAppointmentForPatient(
  accountUserId: string,
  input: BookAppointmentInput,
  todayStr: string = jakartaTodayStr(),
) {
  const ownedPatient = await getOwnedPatient(accountUserId, input.patientId);
  if (!ownedPatient) {
    throw new PatientNotOwnedError();
  }

  validateBookingDate(input.appointmentDate, todayStr);
  const targetDate = parseDateOnlyUtc(input.appointmentDate);
  const expectedDay = dayOfWeekFromDateStr(input.appointmentDate);

  return db.$transaction(async (tx) => {
    // Kunci baris sesi jadwal agar pengecekan kuota dan penulisan janji berjalan serial per sesi.
    await tx.$queryRaw`SELECT id FROM doctor_schedules WHERE id = ${input.scheduleId} FOR UPDATE`;

    const schedule = await tx.doctorSchedule.findUnique({
      where: { id: input.scheduleId },
      include: {
        doctor: { select: { id: true, role: true, isActive: true } },
      },
    });

    if (
      !schedule ||
      !schedule.isActive ||
      schedule.doctorId !== input.doctorId ||
      schedule.doctor.role !== "DOCTOR" ||
      !schedule.doctor.isActive ||
      schedule.dayOfWeek !== expectedDay
    ) {
      throw new InvalidBookingDateError(
        "Sesi jadwal tidak aktif atau tidak sesuai dengan dokter dan hari yang dipilih.",
      );
    }

    const duplicate = await tx.appointment.findFirst({
      where: {
        patientId: ownedPatient.id,
        doctorId: schedule.doctorId,
        appointmentDate: targetDate,
        status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new DuplicateAppointmentError();
    }

    const usedCount = await tx.appointment.count({
      where: {
        doctorId: schedule.doctorId,
        appointmentDate: targetDate,
        status: { in: [...ACTIVE_QUOTA_STATUSES] },
        OR: [
          { scheduleId: schedule.id },
          { scheduleId: null, startTime: schedule.startTime, endTime: schedule.endTime },
        ],
      },
    });

    if (usedCount >= schedule.quota) {
      throw new QuotaFullError();
    }

    const created = await tx.appointment.create({
      data: {
        patientId: ownedPatient.id,
        doctorId: schedule.doctorId,
        scheduleId: schedule.id,
        appointmentDate: targetDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        queueNumber: null,
        status: "PENDING",
        chiefComplaint: input.chiefComplaint.trim(),
      },
    });

    await tx.appointmentHistory.create({
      data: {
        appointmentId: created.id,
        status: "PENDING",
        notes: "Janji temu diajukan oleh pasien (Menunggu Persetujuan).",
        changedByUserId: accountUserId,
      },
    });

    return created;
  });
}

/** Batalkan janji pasien (hanya boleh bila masih PENDING dan milik akun yang login). */
export async function cancelPatientAppointment(accountUserId: string, appointmentId: string) {
  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { id: true, accountUserId: true, deletedAt: true } },
    },
  });

  if (
    !appointment ||
    appointment.patient.deletedAt !== null ||
    appointment.patient.accountUserId !== accountUserId
  ) {
    throw new PatientNotOwnedError("Janji temu tidak ditemukan.");
  }

  if (appointment.status !== "PENDING") {
    throw new InvalidAppointmentStateError(
      "Hanya janji yang masih menunggu persetujuan yang dapat dibatalkan.",
    );
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED" },
    });

    await tx.appointmentHistory.create({
      data: {
        appointmentId: appointment.id,
        status: "CANCELLED",
        notes: "Dibatalkan oleh pasien.",
        changedByUserId: accountUserId,
      },
    });

    return updated;
  });
}
