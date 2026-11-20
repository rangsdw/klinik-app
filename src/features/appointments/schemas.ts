import { z } from "zod";

export const DAY_OPTIONS = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 0, label: "Minggu" },
] as const;

export const DAY_LABEL: Record<number, string> = {
  0: "Minggu",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
};

/** Urutan tampilan hari dalam seminggu (Senin -> Minggu). */
export const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const doctorScheduleSchema = z
  .object({
    doctorId: z.string().trim().min(1, "Pilih dokter"),
    dayOfWeek: z.coerce
      .number({ invalid_type_error: "Pilih hari praktik" })
      .int("Hari tidak valid")
      .min(0, "Hari tidak valid")
      .max(6, "Hari tidak valid"),
    startTime: z
      .string()
      .trim()
      .regex(TIME_REGEX, "Format jam mulai harus HH:mm (contoh: 08:00)"),
    endTime: z
      .string()
      .trim()
      .regex(TIME_REGEX, "Format jam selesai harus HH:mm (contoh: 12:00)"),
    quota: z.coerce
      .number({ invalid_type_error: "Kuota harus berupa angka" })
      .int("Kuota harus bilangan bulat")
      .min(1, "Kuota minimal 1 pasien")
      .max(200, "Kuota maksimal 200 pasien"),
  })
  .refine((data) => data.endTime > data.startTime, {
    path: ["endTime"],
    message: "Jam selesai harus setelah jam mulai",
  });

export type DoctorScheduleInput = z.infer<typeof doctorScheduleSchema>;

export const MAX_BOOKING_DAYS_AHEAD = 30;

export const ACTIVE_QUOTA_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;

export type AppointmentStatusKey =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "REJECTED";

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatusKey, string> = {
  PENDING: "Menunggu Persetujuan",
  CONFIRMED: "Disetujui",
  IN_PROGRESS: "Sedang Diperiksa",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  NO_SHOW: "Tidak Hadir",
  REJECTED: "Ditolak",
};

export const APPOINTMENT_STATUS_VARIANT: Record<
  AppointmentStatusKey,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  PENDING: "warning",
  CONFIRMED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
  NO_SHOW: "danger",
  REJECTED: "danger",
};

/** Format nomor antrean integer menjadi seperti "A-05". */
export function formatQueueNumber(queueNumber: number, prefix = "A"): string {
  return `${prefix}-${String(queueNumber).padStart(2, "0")}`;
}

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const bookAppointmentSchema = z.object({
  patientId: z.string().trim().min(1, "Pilih pasien"),
  doctorId: z.string().trim().min(1, "Pilih dokter"),
  scheduleId: z.string().trim().min(1, "Pilih sesi jadwal"),
  appointmentDate: z.string().trim().regex(DATE_REGEX, "Format tanggal tidak valid"),
  chiefComplaint: z
    .string()
    .trim()
    .min(3, "Keluhan singkat minimal 3 karakter")
    .max(500, "Keluhan maksimal 500 karakter"),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;

export const rejectAppointmentSchema = z.object({
  appointmentId: z.string().trim().min(1, "ID janji temu wajib diisi"),
  reason: z
    .string()
    .trim()
    .min(5, "Alasan penolakan minimal 5 karakter")
    .max(500, "Alasan penolakan maksimal 500 karakter"),
});

export type RejectAppointmentInput = z.infer<typeof rejectAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  appointmentId: z.string().trim().min(1, "ID janji temu wajib diisi"),
  scheduleId: z.string().trim().min(1, "Pilih sesi jadwal tujuan"),
  appointmentDate: z.string().trim().regex(DATE_REGEX, "Format tanggal tidak valid"),
  reason: z
    .string()
    .trim()
    .min(5, "Alasan penjadwalan ulang minimal 5 karakter")
    .max(500, "Alasan penjadwalan ulang maksimal 500 karakter"),
});

export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

