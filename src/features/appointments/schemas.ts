import { z } from "zod";
import { walkInNewPatientSchema } from "@/features/patients/schemas";

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
    startTime: z.string().trim().regex(TIME_REGEX, "Format jam mulai harus HH:mm (contoh: 08:00)"),
    endTime: z.string().trim().regex(TIME_REGEX, "Format jam selesai harus HH:mm (contoh: 12:00)"),
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
  "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "REJECTED";

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

export const checkInLookupSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Masukkan hasil pindai QR, No. RM, atau nama pasien")
    .max(160, "Kata kunci terlalu panjang"),
});

export const performCheckInSchema = z.object({
  appointmentId: z.string().trim().min(1, "Pilih janji temu untuk check-in"),
  method: z.enum(["QR", "MANUAL"]),
});

export type PerformCheckInInput = z.infer<typeof performCheckInSchema>;

const walkInBaseFields = {
  doctorId: z.string().trim().min(1, "Pilih dokter"),
  scheduleId: z.string().trim().min(1, "Pilih sesi praktik hari ini"),
  chiefComplaint: z
    .string()
    .trim()
    .min(3, "Keluhan singkat minimal 3 karakter")
    .max(500, "Keluhan maksimal 500 karakter"),
};

export const walkInRegistrationSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("EXISTING"),
    patientId: z.string().trim().min(1, "Pilih pasien terlebih dahulu"),
    ...walkInBaseFields,
  }),
  z.object({
    mode: z.literal("NEW"),
    newPatient: walkInNewPatientSchema,
    ...walkInBaseFields,
  }),
]);

export type WalkInRegistrationInput = z.infer<typeof walkInRegistrationSchema>;

export type QueueDisplayStatus =
  "NOT_ARRIVED" | "WAITING" | "CALLED" | "IN_SERVICE" | "COMPLETED" | "NO_SHOW";

export const QUEUE_DISPLAY_STATUS_LABEL: Record<QueueDisplayStatus, string> = {
  NOT_ARRIVED: "Belum datang",
  WAITING: "Menunggu",
  CALLED: "Dipanggil",
  IN_SERVICE: "Sedang dilayani",
  COMPLETED: "Selesai",
  NO_SHOW: "Tidak hadir",
};

export const QUEUE_DISPLAY_STATUS_VARIANT: Record<
  QueueDisplayStatus,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  NOT_ARRIVED: "neutral",
  WAITING: "info",
  CALLED: "warning",
  IN_SERVICE: "success",
  COMPLETED: "neutral",
  NO_SHOW: "danger",
};

export type PatientQueueDisplayStatus =
  "PENDING" | "CONFIRMED_NOT_CHECKED_IN" | "WAITING" | "CALLED" | "IN_SERVICE" | "COMPLETED";

export const PATIENT_QUEUE_STATUS_LABEL: Record<PatientQueueDisplayStatus, string> = {
  PENDING: "Menunggu persetujuan",
  CONFIRMED_NOT_CHECKED_IN: "Disetujui, belum check-in",
  WAITING: "Sudah check-in, menunggu",
  CALLED: "Dipanggil",
  IN_SERVICE: "Sedang dilayani",
  COMPLETED: "Selesai",
};

export const PATIENT_QUEUE_STATUS_VARIANT: Record<
  PatientQueueDisplayStatus,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  PENDING: "warning",
  CONFIRMED_NOT_CHECKED_IN: "info",
  WAITING: "info",
  CALLED: "success",
  IN_SERVICE: "success",
  COMPLETED: "neutral",
};

export const callNextQueueSchema = z.object({
  doctorId: z.string().trim().min(1, "Dokter wajib dipilih"),
});

export const recallQueueSchema = z.object({
  appointmentId: z.string().trim().min(1, "ID janji temu wajib diisi"),
});

export const markNoShowSchema = z.object({
  appointmentId: z.string().trim().min(1, "ID janji temu wajib diisi"),
});
