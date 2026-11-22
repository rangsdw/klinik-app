import "server-only";
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  addDaysToDateStr,
  dayOfWeekFromDateStr,
  jakartaTodayStr,
  parseDateOnlyUtc,
  toDateInput,
} from "@/lib/date";
import { getOwnedPatient } from "@/features/patients/queries";
import {
  findPatientByIdForStaff,
  type StaffPatientSummary,
} from "@/features/patients/staff-queries";
import {
  ACTIVE_QUOTA_STATUSES,
  DATE_REGEX,
  formatQueueNumber,
  MAX_BOOKING_DAYS_AHEAD,
  type BookAppointmentInput,
  type PerformCheckInInput,
  type RejectAppointmentInput,
  type RescheduleAppointmentInput,
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

type CounterTx = Pick<Prisma.TransactionClient, "$executeRaw" | "$queryRaw">;

export function queueCounterKey(doctorId: string, dateStr: string): string {
  return `queue-${doctorId}-${dateStr}`.slice(0, 64);
}

/** Nomor antrean harian dokter yang atomik lewat tabel counters (pola src/features/patients/mrn.ts). */
export async function nextQueueNumber(
  tx: CounterTx,
  doctorId: string,
  dateStr: string,
): Promise<number> {
  const key = queueCounterKey(doctorId, dateStr);
  await tx.$executeRaw`INSERT INTO counters (\`key\`, value) VALUES (${key}, 1) ON DUPLICATE KEY UPDATE value = value + 1`;
  const rows = await tx.$queryRaw<{ value: number }[]>`SELECT value FROM counters WHERE \`key\` = ${key}`;
  const value = Number(rows[0]?.value);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error("Gagal membuat nomor antrean.");
  }
  return value;
}

/** Titik sambung notifikasi status janji (belum mengirim email/WhatsApp). */
export async function notifyAppointmentStatus(params: {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  dateStr: string;
  startTime: string;
  status: "CONFIRMED" | "REJECTED" | "RESCHEDULED";
  queueNumber?: number;
  reason?: string;
}): Promise<void> {
  // TODO(notifikasi): kirim email via sendMail (src/lib/mail.ts) atau WhatsApp saat kredensial tersedia.
  void params;
}

/** Setujui janji PENDING dan terbitkan nomor antrean atomik per dokter per hari. */
export async function approveAppointmentByStaff(staffUserId: string, appointmentId: string) {
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${appointmentId} FOR UPDATE`;

    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { select: { name: true } },
        doctor: { select: { name: true } },
      },
    });

    if (!appointment) {
      throw new InvalidAppointmentStateError("Janji temu tidak ditemukan.");
    }
    if (appointment.status !== "PENDING") {
      throw new InvalidAppointmentStateError(
        "Janji temu sudah diproses dan tidak dapat disetujui ulang.",
      );
    }

    const dateStr = toDateInput(appointment.appointmentDate);
    const queueNumber = await nextQueueNumber(tx, appointment.doctorId, dateStr);

    const updated = await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "CONFIRMED",
        queueNumber,
        rejectionReason: null,
      },
    });

    const formattedQueueNumber = formatQueueNumber(queueNumber);

    await tx.appointmentHistory.create({
      data: {
        appointmentId: appointment.id,
        status: "CONFIRMED",
        notes: `Disetujui oleh staf pendaftaran. Nomor antrean: ${formattedQueueNumber}.`,
        changedByUserId: staffUserId,
      },
    });

    return {
      id: updated.id,
      queueNumber,
      formattedQueueNumber,
      patientName: appointment.patient.name,
      doctorName: appointment.doctor.name,
      dateStr,
      startTime: appointment.startTime,
    };
  });

  await notifyAppointmentStatus({
    appointmentId: result.id,
    patientName: result.patientName,
    doctorName: result.doctorName,
    dateStr: result.dateStr,
    startTime: result.startTime,
    status: "CONFIRMED",
    queueNumber: result.queueNumber,
  });

  return {
    id: result.id,
    queueNumber: result.queueNumber,
    formattedQueueNumber: result.formattedQueueNumber,
  };
}

/** Tolak janji PENDING dengan alasan wajib dan kembalikan kuota sesi. */
export async function rejectAppointmentByStaff(
  staffUserId: string,
  input: RejectAppointmentInput,
) {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new InvalidAppointmentStateError("Alasan penolakan minimal 5 karakter.");
  }

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${input.appointmentId} FOR UPDATE`;

    const appointment = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      include: {
        patient: { select: { name: true } },
        doctor: { select: { name: true } },
      },
    });

    if (!appointment) {
      throw new InvalidAppointmentStateError("Janji temu tidak ditemukan.");
    }
    if (appointment.status !== "PENDING") {
      throw new InvalidAppointmentStateError(
        "Janji temu sudah diproses dan tidak dapat ditolak.",
      );
    }

    const updated = await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        queueNumber: null,
      },
    });

    await tx.appointmentHistory.create({
      data: {
        appointmentId: appointment.id,
        status: "REJECTED",
        notes: `Ditolak oleh staf pendaftaran: ${reason}`,
        changedByUserId: staffUserId,
      },
    });

    return {
      updated,
      patientName: appointment.patient.name,
      doctorName: appointment.doctor.name,
      dateStr: toDateInput(appointment.appointmentDate),
      startTime: appointment.startTime,
    };
  });

  await notifyAppointmentStatus({
    appointmentId: result.updated.id,
    patientName: result.patientName,
    doctorName: result.doctorName,
    dateStr: result.dateStr,
    startTime: result.startTime,
    status: "REJECTED",
    reason,
  });

  return result.updated;
}

/**
 * Jadwalkan ulang janji PENDING atau CONFIRMED ke tanggal/sesi aktif lain yang masih memiliki kuota.
 * Jika janji sudah CONFIRMED, terbitkan nomor antrean baru untuk tanggal tujuan.
 */
export async function rescheduleAppointmentByStaff(
  staffUserId: string,
  input: RescheduleAppointmentInput,
  todayStr: string = jakartaTodayStr(),
) {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new InvalidAppointmentStateError("Alasan penjadwalan ulang minimal 5 karakter.");
  }

  validateBookingDate(input.appointmentDate, todayStr);
  const targetDate = parseDateOnlyUtc(input.appointmentDate);
  const expectedDay = dayOfWeekFromDateStr(input.appointmentDate);

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${input.appointmentId} FOR UPDATE`;

    const appointment = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      include: {
        patient: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
      },
    });

    if (!appointment) {
      throw new InvalidAppointmentStateError("Janji temu tidak ditemukan.");
    }

    if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
      throw new InvalidAppointmentStateError(
        "Hanya janji berstatus Menunggu Persetujuan atau Disetujui yang dapat dijadwalkan ulang.",
      );
    }

    await tx.$queryRaw`SELECT id FROM doctor_schedules WHERE id = ${input.scheduleId} FOR UPDATE`;

    const targetSchedule = await tx.doctorSchedule.findUnique({
      where: { id: input.scheduleId },
      include: {
        doctor: { select: { id: true, name: true, role: true, isActive: true } },
      },
    });

    if (
      !targetSchedule ||
      !targetSchedule.isActive ||
      targetSchedule.doctor.role !== "DOCTOR" ||
      !targetSchedule.doctor.isActive ||
      targetSchedule.dayOfWeek !== expectedDay
    ) {
      throw new InvalidBookingDateError(
        "Sesi jadwal tujuan tidak aktif atau tidak sesuai dengan hari yang dipilih.",
      );
    }

    const oldDateStr = toDateInput(appointment.appointmentDate);
    const sameSession =
      oldDateStr === input.appointmentDate &&
      (appointment.scheduleId === targetSchedule.id ||
        (appointment.doctorId === targetSchedule.doctorId &&
          appointment.startTime === targetSchedule.startTime &&
          appointment.endTime === targetSchedule.endTime));
    if (sameSession) {
      throw new InvalidBookingDateError("Pilih tanggal atau sesi yang berbeda dari jadwal saat ini.");
    }

    const duplicate = await tx.appointment.findFirst({
      where: {
        id: { not: appointment.id },
        patientId: appointment.patientId,
        doctorId: targetSchedule.doctorId,
        appointmentDate: targetDate,
        status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new DuplicateAppointmentError(
        "Pasien sudah memiliki janji aktif lain pada dokter dan tanggal tujuan.",
      );
    }

    const usedCount = await tx.appointment.count({
      where: {
        id: { not: appointment.id },
        doctorId: targetSchedule.doctorId,
        appointmentDate: targetDate,
        status: { in: [...ACTIVE_QUOTA_STATUSES] },
        OR: [
          { scheduleId: targetSchedule.id },
          {
            scheduleId: null,
            startTime: targetSchedule.startTime,
            endTime: targetSchedule.endTime,
          },
        ],
      },
    });

    if (usedCount >= targetSchedule.quota) {
      throw new QuotaFullError("Kuota sesi tujuan sudah penuh.");
    }

    const newQueueNumber =
      appointment.status === "CONFIRMED"
        ? await nextQueueNumber(tx, targetSchedule.doctorId, input.appointmentDate)
        : null;

    const updated = await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        doctorId: targetSchedule.doctorId,
        scheduleId: targetSchedule.id,
        appointmentDate: targetDate,
        startTime: targetSchedule.startTime,
        endTime: targetSchedule.endTime,
        queueNumber: newQueueNumber,
        rescheduledAt: new Date(),
        rescheduleNote: reason,
      },
    });

    const queueNote =
      newQueueNumber !== null ? ` (Antrean baru: ${formatQueueNumber(newQueueNumber)})` : "";

    await tx.appointmentHistory.create({
      data: {
        appointmentId: appointment.id,
        status: appointment.status,
        notes: `Dijadwalkan ulang dari ${oldDateStr} (${appointment.startTime}–${appointment.endTime}) ke ${input.appointmentDate} (${targetSchedule.startTime}–${targetSchedule.endTime}). Alasan: ${reason}${queueNote}`,
        changedByUserId: staffUserId,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      queueNumber: newQueueNumber,
      formattedQueueNumber: newQueueNumber !== null ? formatQueueNumber(newQueueNumber) : null,
      patientName: appointment.patient.name,
      doctorName: targetSchedule.doctor.name,
      startTime: targetSchedule.startTime,
    };
  });

  await notifyAppointmentStatus({
    appointmentId: result.id,
    patientName: result.patientName,
    doctorName: result.doctorName,
    dateStr: input.appointmentDate,
    startTime: result.startTime,
    status: "RESCHEDULED",
    queueNumber: result.queueNumber ?? undefined,
    reason,
  });

  return {
    id: result.id,
    status: result.status,
    queueNumber: result.queueNumber,
    formattedQueueNumber: result.formattedQueueNumber,
  };
}

export type CheckInAppointmentItem = {
  id: string;
  doctorId: string;
  doctorName: string;
  startTime: string;
  endTime: string;
  queueNumber: number | null;
  formattedQueueNumber: string | null;
  status: AppointmentStatus;
  checkedInAt: Date | null;
};

export type CheckInLookupResult = {
  patient: StaffPatientSummary;
  method: "QR" | "MANUAL";
  eligibleConfirmed: CheckInAppointmentItem[];
  alreadyCheckedIn: CheckInAppointmentItem[];
  pendingAppointments: CheckInAppointmentItem[];
};

/**
 * Ambil daftar janji pasien hari ini untuk layar check-in staf.
 * Hanya mengembalikan data minimum pasien (tanpa alergi/kondisi medis).
 */
export async function lookupPatientCheckInToday(
  patientId: string,
  method: "QR" | "MANUAL",
  todayStr: string = jakartaTodayStr(),
): Promise<CheckInLookupResult | null> {
  const patient = await findPatientByIdForStaff(patientId);
  if (!patient) return null;

  const rows = await db.appointment.findMany({
    where: {
      patientId: patient.id,
      appointmentDate: parseDateOnlyUtc(todayStr),
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
    },
    include: {
      doctor: { select: { name: true } },
    },
    orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
  });

  const mapped: CheckInAppointmentItem[] = rows.map((r) => ({
    id: r.id,
    doctorId: r.doctorId,
    doctorName: r.doctor.name,
    startTime: r.startTime,
    endTime: r.endTime,
    queueNumber: r.queueNumber,
    formattedQueueNumber: r.queueNumber !== null ? formatQueueNumber(r.queueNumber) : null,
    status: r.status,
    checkedInAt: r.checkedInAt,
  }));

  return {
    patient,
    method,
    eligibleConfirmed: mapped.filter((a) => a.status === "CONFIRMED" && a.checkedInAt === null),
    alreadyCheckedIn: mapped.filter((a) => a.checkedInAt !== null),
    pendingAppointments: mapped.filter((a) => a.status === "PENDING"),
  };
}

/**
 * Catat kedatangan (check-in) untuk janji CONFIRMED hari ini.
 * Idempoten dan aman dari klik ganda / dua staf bersamaan (update bersyarat checkedInAt IS NULL).
 */
export async function performAppointmentCheckIn(
  staffUserId: string,
  input: PerformCheckInInput,
  todayStr: string = jakartaTodayStr(),
): Promise<{
  alreadyCheckedIn: boolean;
  checkedInAt: Date;
  queueNumber: number | null;
  formattedQueueNumber: string | null;
}> {
  const appointment = await db.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true,
      appointmentDate: true,
      status: true,
      checkedInAt: true,
      queueNumber: true,
    },
  });

  if (!appointment) {
    throw new InvalidAppointmentStateError("Janji temu tidak ditemukan.");
  }

  if (toDateInput(appointment.appointmentDate) !== todayStr) {
    throw new InvalidAppointmentStateError("Hanya janji temu hari ini yang dapat di-check-in.");
  }

  if (appointment.status === "PENDING") {
    throw new InvalidAppointmentStateError("Janji belum disetujui.");
  }

  if (appointment.status !== "CONFIRMED") {
    throw new InvalidAppointmentStateError("Status janji temu ini tidak dapat di-check-in.");
  }

  if (appointment.checkedInAt !== null) {
    return {
      alreadyCheckedIn: true,
      checkedInAt: appointment.checkedInAt,
      queueNumber: appointment.queueNumber,
      formattedQueueNumber:
        appointment.queueNumber !== null ? formatQueueNumber(appointment.queueNumber) : null,
    };
  }

  const targetDate = parseDateOnlyUtc(todayStr);

  return db.$transaction(async (tx) => {
    const now = new Date();
    const updated = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        status: "CONFIRMED",
        appointmentDate: targetDate,
        checkedInAt: null,
      },
      data: {
        checkedInAt: now,
        checkedInByUserId: staffUserId,
      },
    });

    if (updated.count === 0) {
      const fresh = await tx.appointment.findUnique({
        where: { id: appointment.id },
        select: { checkedInAt: true, queueNumber: true },
      });
      if (fresh?.checkedInAt) {
        return {
          alreadyCheckedIn: true,
          checkedInAt: fresh.checkedInAt,
          queueNumber: fresh.queueNumber,
          formattedQueueNumber:
            fresh.queueNumber !== null ? formatQueueNumber(fresh.queueNumber) : null,
        };
      }
      throw new InvalidAppointmentStateError("Janji temu tidak dapat di-check-in saat ini.");
    }

    await tx.appointmentHistory.create({
      data: {
        appointmentId: appointment.id,
        status: "CONFIRMED",
        notes: `Check-in berhasil oleh staf pendaftaran (metode: ${input.method === "QR" ? "QR Code" : "Manual"}).`,
        changedByUserId: staffUserId,
      },
    });

    return {
      alreadyCheckedIn: false,
      checkedInAt: now,
      queueNumber: appointment.queueNumber,
      formattedQueueNumber:
        appointment.queueNumber !== null ? formatQueueNumber(appointment.queueNumber) : null,
    };
  });
}
