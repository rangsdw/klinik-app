import { z } from "zod";
import { isIndonesianPhone, normalizePhone } from "@/lib/normalize";
import {
  birthDateSchema,
  optionalNikSchema,
  passwordSchema,
  phoneSchema,
} from "@/features/auth/schemas";

export const RELATIONSHIP_LABEL = {
  SELF: "Diri sendiri",
  SPOUSE: "Suami/Istri",
  CHILD: "Anak",
  PARENT: "Orang tua",
  SIBLING: "Saudara kandung",
  OTHER: "Lainnya",
} as const;

export const GENDER_LABEL = { MALE: "Laki-laki", FEMALE: "Perempuan" } as const;

export const BLOOD_TYPES = ["A", "B", "AB", "O"] as const;

/** Hubungan yang boleh dipilih saat menambah anggota (SELF hanya dibuat otomatis saat registrasi). */
export const MEMBER_RELATIONSHIPS = ["SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"] as const;

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} terlalu panjang`).optional();

export const familyMemberSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(120, "Nama terlalu panjang"),
  relationship: z.enum(["SELF", ...MEMBER_RELATIONSHIPS], {
    errorMap: () => ({ message: "Pilih hubungan dengan pemilik akun" }),
  }),
  nik: optionalNikSchema,
  birthDate: birthDateSchema,
  gender: z.enum(["MALE", "FEMALE"], { errorMap: () => ({ message: "Pilih jenis kelamin" }) }),
  bloodType: z.enum(["A", "B", "AB", "O", ""]).optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || isIndonesianPhone(normalizePhone(v)),
      "No. HP tidak valid (contoh: 0812 3456 7890)",
    ),
  address: optionalText(500, "Alamat"),
  allergies: optionalText(1000, "Catatan alergi"),
  specialConditions: optionalText(1000, "Catatan kondisi khusus"),
});
export type FamilyMemberInput = z.infer<typeof familyMemberSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(120, "Nama terlalu panjang"),
  email: z.string().trim().min(1, "Email wajib diisi").email("Format email tidak valid"),
  phone: phoneSchema,
  syncPatient: z.boolean().optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password lama wajib diisi"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
