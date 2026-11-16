import { z } from "zod";
import { isIndonesianPhone, normalizeNik, normalizePhone } from "@/lib/normalize";

/**
 * Skema Zod dipakai di klien (React Hook Form) dan server (sumber kebenaran).
 * Skema tidak men-transform nilai agar tipe input = output; normalisasi dilakukan di service.
 */

export const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(72, "Password maksimal 72 karakter")
  .regex(/[A-Za-z]/, "Password harus mengandung huruf")
  .regex(/\d/, "Password harus mengandung angka");

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "No. HP wajib diisi")
  .refine(
    (v) => isIndonesianPhone(normalizePhone(v)),
    "No. HP tidak valid (contoh: 0812 3456 7890)",
  );

export const optionalNikSchema = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || /^\d{16}$/.test(normalizeNik(v)), "NIK harus 16 digit angka");

export const birthDateSchema = z
  .string()
  .min(1, "Tanggal lahir wajib diisi")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal lahir tidak valid")
  .refine((v) => new Date(v) <= new Date(), "Tanggal lahir tidak boleh di masa depan")
  .refine((v) => new Date(v).getFullYear() >= 1900, "Tanggal lahir tidak valid");

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email atau No. HP wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
  remember: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "true" || v === "on"),
});
export type LoginInput = z.input<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Nama lengkap minimal 3 karakter")
      .max(120, "Nama terlalu panjang"),
    email: z.string().trim().min(1, "Email wajib diisi").email("Format email tidak valid"),
    phone: phoneSchema,
    nik: optionalNikSchema,
    birthDate: birthDateSchema,
    gender: z.enum(["MALE", "FEMALE"], { errorMap: () => ({ message: "Pilih jenis kelamin" }) }),
    address: z.string().trim().max(500, "Alamat terlalu panjang").optional(),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
    consent: z.literal(true, {
      errorMap: () => ({ message: "Anda perlu menyetujui penggunaan data untuk mendaftar" }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama",
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email wajib diisi").email("Format email tidak valid"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama",
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
