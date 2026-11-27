import "server-only";
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  addDaysToDateStr,
  ageLabel,
  dayOfWeekFromDateStr,
  formatDate,
  jakartaCurrentTimeStr,
  jakartaTodayStr,
  parseDateOnlyUtc,
  toDateInput,
} from "@/lib/date";
import { clinicConfig } from "@/config/clinic";
import { env } from "@/lib/env";
import { emailLayout, sendMail } from "@/lib/mail";
import { activePatientWhere, getOwnedPatient } from "@/features/patients/queries";
import { createPatient, normalizeMemberInput } from "@/features/patients/service";
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
  type WalkInRegistrationInput,
} from "@/features/appointments/schemas";

export type TimeSlot = {
  id?: string;
  startTime: string;
  endTime: string;
};

export class ScheduleOverlapError extends Error {
  constructor(
    message = "Sesi tumpang tindih dengan jadwal aktif lain pada dokter dan hari yang sama.",
  ) {
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

export class DuplicatePatientError extends Error {
  readonly existingPatient: StaffPatientSummary;

  constructor(existingPatient: StaffPatientSummary) {
    super(
      `Pasien sudah terdaftar dengan nama ${existingPatient.name} (${existingPatient.medicalRecordNumber}).`,
    );
    this.name = "DuplicatePatientError";
    this.existingPatient = existingPatient;
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
        source: "ONLINE",
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
  const rows = await tx.$queryRaw<
    { value: number }[]
  >`SELECT value FROM counters WHERE \`key\` = ${key}`;
  const value = Number(rows[0]?.value);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error("Gagal membuat nomor antrean.");
  }
  return value;
}

export type AppointmentNotificationParams = {
  appointmentId: string;
  recipientEmail?: string | null;
  patientName: string;
  doctorName: string;
  dateStr: string;
  startTime: string;
  endTime?: string;
  status: "CONFIRMED" | "REJECTED" | "RESCHEDULED";
  queueNumber?: number;
  reason?: string;
};

/** Bentuk subjek, teks polos, dan HTML email status janji temu pasien. */
export function buildAppointmentStatusEmail(params: AppointmentNotificationParams): {
  subject: string;
  text: string;
  html: string;
} {
  const clinicName = clinicConfig.name;
  const formattedDate = formatDate(parseDateOnlyUtc(params.dateStr));
  const timeLabel = params.endTime
    ? `${params.startTime} s.d. ${params.endTime} WIB`
    : `${params.startTime} WIB`;
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const queueLabel = params.queueNumber ? formatQueueNumber(params.queueNumber) : null;

  if (params.status === "CONFIRMED") {
    const queueInfo = queueLabel ? ` Nomor antrean Anda: ${queueLabel}.` : "";
    const intro = `Janji temu untuk ${params.patientName} bersama ${params.doctorName} pada ${formattedDate} (${timeLabel}) telah disetujui.${queueInfo}`;
    const outro =
      "Setibanya di klinik, tunjukkan QR Code pasien di portal agar staf pendaftaran dapat melakukan check-in.";
    return {
      subject: `[${clinicName}] Janji temu disetujui${queueLabel ? ` (${queueLabel})` : ""}`,
      text: `${intro}\n\nPantau antrean Anda di: ${appUrl}/pasien/antrean\n\n${outro}`,
      html: emailLayout({
        title: "Janji Temu Disetujui",
        intro,
        actionLabel: "Pantau Antrean Saya",
        actionUrl: `${appUrl}/pasien/antrean`,
        outro,
      }),
    };
  }

  if (params.status === "REJECTED") {
    const reasonText = params.reason ? ` Alasan: ${params.reason}.` : "";
    const intro = `Mohon maaf, pengajuan janji temu untuk ${params.patientName} bersama ${params.doctorName} pada ${formattedDate} (${timeLabel}) tidak dapat diproses.${reasonText}`;
    const outro = "Silakan ajukan ulang janji temu untuk jadwal praktik dokter yang tersedia.";
    return {
      subject: `[${clinicName}] Pengajuan janji temu ditolak`,
      text: `${intro}\n\nLihat jadwal tersedia di: ${appUrl}/pasien/janji\n\n${outro}`,
      html: emailLayout({
        title: "Pengajuan Janji Temu Ditolak",
        intro,
        actionLabel: "Buat Janji Ulang",
        actionUrl: `${appUrl}/pasien/janji`,
        outro,
      }),
    };
  }

  const queueInfo = queueLabel ? ` Nomor antrean baru: ${queueLabel}.` : "";
  const reasonText = params.reason ? ` Alasan: ${params.reason}.` : "";
  const intro = `Janji temu untuk ${params.patientName} telah dijadwalkan ulang menjadi bersama ${params.doctorName} pada ${formattedDate} (${timeLabel}).${queueInfo}${reasonText}`;
  const outro = "Buka menu Janji di portal pasien untuk melihat rincian jadwal terbaru.";
  return {
    subject: `[${clinicName}] Perubahan jadwal janji temu${queueLabel ? ` (${queueLabel})` : ""}`,
    text: `${intro}\n\nLihat jadwal terbaru di: ${appUrl}/pasien/janji\n\n${outro}`,
    html: emailLayout({
      title: "Janji Temu Dijadwalkan Ulang",
      intro,
      actionLabel: "Lihat Jadwal Terbaru",
      actionUrl: `${appUrl}/pasien/janji`,
      outro,
    }),
  };
}

/**
 * Kirim notifikasi perubahan status janji ke email akun pasien (via `src/lib/mail.ts`).
 * Tanpa kredensial SMTP di lokal, `sendMail` mencetak isi email ke console server.
 */
export async function notifyAppointmentStatus(
  params: AppointmentNotificationParams,
): Promise<void> {
  if (!params.recipientEmail) return;
  if (env.NODE_ENV === "test" && !env.SMTP_HOST) return;

  const mail = buildAppointmentStatusEmail(params);
  try {
    await sendMail({
      to: params.recipientEmail,
      ...mail,
    });
  } catch (error) {
    console.error(`[notifikasi] Gagal mengirim email status janji ${params.appointmentId}:`, error);
  }
}

/** Setujui janji PENDING dan terbitkan nomor antrean atomik per dokter per hari. */
export async function approveAppointmentByStaff(staffUserId: string, appointmentId: string) {
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${appointmentId} FOR UPDATE`;

    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { select: { name: true, account: { select: { email: true } } } },
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
      recipientEmail: appointment.patient.account?.email ?? null,
      patientName: appointment.patient.name,
      doctorName: appointment.doctor.name,
      dateStr,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
    };
  });

  await notifyAppointmentStatus({
    appointmentId: result.id,
    recipientEmail: result.recipientEmail,
    patientName: result.patientName,
    doctorName: result.doctorName,
    dateStr: result.dateStr,
    startTime: result.startTime,
    endTime: result.endTime,
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
export async function rejectAppointmentByStaff(staffUserId: string, input: RejectAppointmentInput) {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new InvalidAppointmentStateError("Alasan penolakan minimal 5 karakter.");
  }

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${input.appointmentId} FOR UPDATE`;

    const appointment = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      include: {
        patient: { select: { name: true, account: { select: { email: true } } } },
        doctor: { select: { name: true } },
      },
    });

    if (!appointment) {
      throw new InvalidAppointmentStateError("Janji temu tidak ditemukan.");
    }
    if (appointment.status !== "PENDING") {
      throw new InvalidAppointmentStateError("Janji temu sudah diproses dan tidak dapat ditolak.");
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
      recipientEmail: appointment.patient.account?.email ?? null,
      patientName: appointment.patient.name,
      doctorName: appointment.doctor.name,
      dateStr: toDateInput(appointment.appointmentDate),
      startTime: appointment.startTime,
      endTime: appointment.endTime,
    };
  });

  await notifyAppointmentStatus({
    appointmentId: result.updated.id,
    recipientEmail: result.recipientEmail,
    patientName: result.patientName,
    doctorName: result.doctorName,
    dateStr: result.dateStr,
    startTime: result.startTime,
    endTime: result.endTime,
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
        patient: { select: { id: true, name: true, account: { select: { email: true } } } },
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
      throw new InvalidBookingDateError(
        "Pilih tanggal atau sesi yang berbeda dari jadwal saat ini.",
      );
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
        source: "ONLINE",
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

    if (appointment.source === "ONLINE" && usedCount >= targetSchedule.quota) {
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
      recipientEmail: appointment.patient.account?.email ?? null,
      patientName: appointment.patient.name,
      doctorName: targetSchedule.doctor.name,
      startTime: targetSchedule.startTime,
      endTime: targetSchedule.endTime,
    };
  });

  await notifyAppointmentStatus({
    appointmentId: result.id,
    recipientEmail: result.recipientEmail,
    patientName: result.patientName,
    doctorName: result.doctorName,
    dateStr: input.appointmentDate,
    startTime: result.startTime,
    endTime: result.endTime,
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

export type WalkInRegistrationResult = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  medicalRecordNumber: string;
  doctorName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  queueNumber: number;
  formattedQueueNumber: string;
  isNewPatient: boolean;
  newPatientQrToken: string | null;
};

/**
 * Daftarkan pasien walk-in (pasien lama atau pasien baru tanpa akun portal) dalam satu transaksi.
 * Walk-in tidak mengurangi kuota booking online dan langsung mendapatkan status CONFIRMED + checkedInAt.
 */
export async function registerWalkInAppointment(
  staffUserId: string,
  input: WalkInRegistrationInput,
  todayStr: string = jakartaTodayStr(),
  currentTimeStr: string = jakartaCurrentTimeStr(),
): Promise<WalkInRegistrationResult> {
  const targetDate = parseDateOnlyUtc(todayStr);
  const expectedDay = dayOfWeekFromDateStr(todayStr);

  return db.$transaction(async (tx) => {
    const schedule = await tx.doctorSchedule.findUnique({
      where: { id: input.scheduleId },
      include: {
        doctor: { select: { id: true, name: true, role: true, isActive: true } },
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
        "Sesi praktik tidak aktif atau bukan untuk jadwal hari ini.",
      );
    }

    if (timeToMinutes(currentTimeStr) > timeToMinutes(schedule.endTime)) {
      throw new InvalidBookingDateError("Sesi praktik dokter ini sudah berakhir untuk hari ini.");
    }

    let patientId: string;
    let patientName: string;
    let medicalRecordNumber: string;
    let isNewPatient = false;
    let newPatientQrToken: string | null = null;

    if (input.mode === "EXISTING") {
      const existing = await tx.patient.findFirst({
        where: activePatientWhere({ id: input.patientId }),
        select: { id: true, name: true, medicalRecordNumber: true },
      });
      if (!existing) {
        throw new InvalidAppointmentStateError("Pasien tidak ditemukan.");
      }
      patientId = existing.id;
      patientName = existing.name;
      medicalRecordNumber = existing.medicalRecordNumber;
    } else {
      const normalized = normalizeMemberInput({
        ...input.newPatient,
        relationship: "OTHER",
      });

      if (normalized.nik) {
        const byNik = await tx.patient.findFirst({
          where: activePatientWhere({ nik: normalized.nik }),
          select: { id: true, name: true, medicalRecordNumber: true, birthDate: true },
        });
        if (byNik) {
          throw new DuplicatePatientError({
            id: byNik.id,
            name: byNik.name,
            medicalRecordNumber: byNik.medicalRecordNumber,
            ageLabel: ageLabel(byNik.birthDate),
          });
        }
      }

      if (normalized.phone) {
        const byIdentity = await tx.patient.findFirst({
          where: activePatientWhere({
            name: normalized.name,
            birthDate: normalized.birthDate,
            phone: normalized.phone,
          }),
          select: { id: true, name: true, medicalRecordNumber: true, birthDate: true },
        });
        if (byIdentity) {
          throw new DuplicatePatientError({
            id: byIdentity.id,
            name: byIdentity.name,
            medicalRecordNumber: byIdentity.medicalRecordNumber,
            ageLabel: ageLabel(byIdentity.birthDate),
          });
        }
      }

      const createdPatient = await createPatient(tx, {
        ...normalized,
        accountUserId: null,
        createdByUserId: staffUserId,
        isSelf: false,
      });

      patientId = createdPatient.id;
      patientName = createdPatient.name;
      medicalRecordNumber = createdPatient.medicalRecordNumber;
      isNewPatient = true;
      newPatientQrToken = createdPatient.qrToken;
    }

    const duplicateAppointment = await tx.appointment.findFirst({
      where: {
        patientId,
        doctorId: schedule.doctorId,
        appointmentDate: targetDate,
        status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
      },
      select: { id: true },
    });

    if (duplicateAppointment) {
      throw new DuplicateAppointmentError(
        "Pasien sudah memiliki janji aktif hari ini pada dokter tersebut. Arahkan ke halaman Check-in.",
      );
    }

    const now = new Date();
    const queueNumber = await nextQueueNumber(tx, schedule.doctorId, todayStr);
    const formattedQueueNumber = formatQueueNumber(queueNumber);

    const createdAppointment = await tx.appointment.create({
      data: {
        patientId,
        doctorId: schedule.doctorId,
        scheduleId: schedule.id,
        source: "WALK_IN",
        appointmentDate: targetDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        queueNumber,
        status: "CONFIRMED",
        checkedInAt: now,
        checkedInByUserId: staffUserId,
        chiefComplaint: input.chiefComplaint.trim(),
      },
    });

    await tx.appointmentHistory.create({
      data: {
        appointmentId: createdAppointment.id,
        status: "CONFIRMED",
        notes: `Pendaftaran walk-in oleh staf pendaftaran. Nomor antrean: ${formattedQueueNumber}.`,
        changedByUserId: staffUserId,
      },
    });

    return {
      appointmentId: createdAppointment.id,
      patientId,
      patientName,
      medicalRecordNumber,
      doctorName: schedule.doctor.name,
      appointmentDate: todayStr,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      queueNumber,
      formattedQueueNumber,
      isNewPatient,
      newPatientQrToken,
    };
  });
}

/**
 * Panggil pasien urutan berikutnya (nomor terkecil berstatus CONFIRMED yang sudah check-in
 * dan belum dipanggil) untuk dokter tertentu hari ini.
 * Aman dari klik ganda / dua staf bersamaan lewat kunci baris dokter + update bersyarat.
 * Staf hanya mengisi `calledAt` dan log riwayat tanpa mengubah status `IN_PROGRESS`/`COMPLETED`.
 */
export async function callNextQueueByStaff(
  staffUserId: string,
  doctorId: string,
  todayStr: string = jakartaTodayStr(),
): Promise<{
  appointmentId: string;
  queueNumber: number;
  formattedQueueNumber: string;
  patientName: string;
  calledAt: Date;
}> {
  const targetDate = parseDateOnlyUtc(todayStr);

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${doctorId} AND role = 'DOCTOR' FOR UPDATE`;

    const doctor = await tx.user.findUnique({
      where: { id: doctorId },
      select: { id: true, role: true },
    });
    if (!doctor || doctor.role !== "DOCTOR") {
      throw new InvalidAppointmentStateError("Dokter tidak ditemukan.");
    }

    const nextAppt = await tx.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate: targetDate,
        status: "CONFIRMED",
        checkedInAt: { not: null },
        calledAt: null,
        queueNumber: { not: null },
        patient: activePatientWhere(),
      },
      include: {
        patient: { select: { name: true } },
      },
      orderBy: [{ queueNumber: "asc" }, { checkedInAt: "asc" }, { createdAt: "asc" }],
    });

    if (!nextAppt || nextAppt.queueNumber === null) {
      throw new InvalidAppointmentStateError(
        "Tidak ada pasien yang sedang menunggu untuk dokter ini.",
      );
    }

    const now = new Date();
    const updated = await tx.appointment.updateMany({
      where: {
        id: nextAppt.id,
        status: "CONFIRMED",
        checkedInAt: { not: null },
        calledAt: null,
      },
      data: {
        calledAt: now,
      },
    });

    if (updated.count === 0) {
      throw new InvalidAppointmentStateError("Pasien ini sudah dipanggil oleh petugas lain.");
    }

    const formattedQueueNumber = formatQueueNumber(nextAppt.queueNumber);

    await tx.appointmentHistory.create({
      data: {
        appointmentId: nextAppt.id,
        status: "CONFIRMED",
        notes: `Dipanggil oleh staf pendaftaran (${formattedQueueNumber}).`,
        changedByUserId: staffUserId,
      },
    });

    return {
      appointmentId: nextAppt.id,
      queueNumber: nextAppt.queueNumber,
      formattedQueueNumber,
      patientName: nextAppt.patient.name,
      calledAt: now,
    };
  });
}

/**
 * Panggil ulang pasien yang sudah pernah dipanggil hari ini (hanya bila masih CONFIRMED).
 */
export async function recallQueueByStaff(
  staffUserId: string,
  appointmentId: string,
  todayStr: string = jakartaTodayStr(),
): Promise<{
  appointmentId: string;
  queueNumber: number | null;
  formattedQueueNumber: string | null;
  patientName: string;
  calledAt: Date;
}> {
  const targetDate = parseDateOnlyUtc(todayStr);

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${appointmentId} FOR UPDATE`;

    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { select: { name: true, deletedAt: true } },
      },
    });

    if (!appointment || appointment.patient.deletedAt !== null) {
      throw new InvalidAppointmentStateError("Antrean pasien tidak ditemukan.");
    }
    if (toDateInput(appointment.appointmentDate) !== todayStr) {
      throw new InvalidAppointmentStateError("Hanya antrean hari ini yang dapat dipanggil ulang.");
    }
    if (appointment.status !== "CONFIRMED" || appointment.calledAt === null) {
      throw new InvalidAppointmentStateError(
        "Hanya pasien yang sudah dipanggil dan belum diperiksa yang dapat dipanggil ulang.",
      );
    }

    const now = new Date();
    const updated = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        appointmentDate: targetDate,
        status: "CONFIRMED",
        calledAt: { not: null },
      },
      data: {
        calledAt: now,
      },
    });

    if (updated.count === 0) {
      throw new InvalidAppointmentStateError(
        "Status antrean sudah berubah dan tidak dapat dipanggil ulang.",
      );
    }

    const formattedQueueNumber =
      appointment.queueNumber !== null ? formatQueueNumber(appointment.queueNumber) : null;
    const queueLabel = formattedQueueNumber ? ` (${formattedQueueNumber})` : "";

    await tx.appointmentHistory.create({
      data: {
        appointmentId: appointment.id,
        status: "CONFIRMED",
        notes: `Dipanggil ulang oleh staf pendaftaran${queueLabel}.`,
        changedByUserId: staffUserId,
      },
    });

    return {
      appointmentId: appointment.id,
      queueNumber: appointment.queueNumber,
      formattedQueueNumber,
      patientName: appointment.patient.name,
      calledAt: now,
    };
  });
}

/**
 * Tandai antrean CONFIRMED hari ini sebagai Tidak Hadir (NO_SHOW).
 */
export async function markAppointmentNoShowByStaff(
  staffUserId: string,
  appointmentId: string,
  todayStr: string = jakartaTodayStr(),
): Promise<{
  appointmentId: string;
  queueNumber: number | null;
  formattedQueueNumber: string | null;
  patientName: string;
}> {
  const targetDate = parseDateOnlyUtc(todayStr);

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${appointmentId} FOR UPDATE`;

    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { select: { name: true, deletedAt: true } },
      },
    });

    if (!appointment || appointment.patient.deletedAt !== null) {
      throw new InvalidAppointmentStateError("Antrean pasien tidak ditemukan.");
    }
    if (toDateInput(appointment.appointmentDate) !== todayStr) {
      throw new InvalidAppointmentStateError(
        "Hanya antrean hari ini yang dapat ditandai tidak hadir.",
      );
    }
    if (appointment.status !== "CONFIRMED") {
      throw new InvalidAppointmentStateError(
        "Hanya antrean yang belum mulai diperiksa yang dapat ditandai tidak hadir.",
      );
    }

    const updated = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        appointmentDate: targetDate,
        status: "CONFIRMED",
      },
      data: {
        status: "NO_SHOW",
      },
    });

    if (updated.count === 0) {
      throw new InvalidAppointmentStateError(
        "Status antrean sudah berubah dan tidak dapat ditandai tidak hadir.",
      );
    }

    const formattedQueueNumber =
      appointment.queueNumber !== null ? formatQueueNumber(appointment.queueNumber) : null;
    const queueLabel = formattedQueueNumber ? ` (${formattedQueueNumber})` : "";

    await tx.appointmentHistory.create({
      data: {
        appointmentId: appointment.id,
        status: "NO_SHOW",
        notes: `Ditandai tidak hadir oleh staf pendaftaran${queueLabel}.`,
        changedByUserId: staffUserId,
      },
    });

    return {
      appointmentId: appointment.id,
      queueNumber: appointment.queueNumber,
      formattedQueueNumber,
      patientName: appointment.patient.name,
    };
  });
}
