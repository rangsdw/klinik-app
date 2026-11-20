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
