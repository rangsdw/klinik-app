/**
 * Identitas klinik. Nama klinik TIDAK boleh di-hardcode di komponen; selalu pakai config ini.
 * Nilai dibaca dari variabel CLINIC_* di .env (server only).
 */
export const clinicConfig = {
  name: process.env.CLINIC_NAME || "Klinik Sehat",
  address: process.env.CLINIC_ADDRESS || "",
  phone: process.env.CLINIC_PHONE || "",
  email: process.env.CLINIC_EMAIL || "",
  hours: process.env.CLINIC_HOURS || "",
  tagline: "Berobat lebih tenang, tanpa antre lama.",
} as const;

/** Batas maksimal anggota keluarga (pasien) per akun. */
export const MAX_FAMILY_MEMBERS = 10;

export const APP_TIMEZONE = "Asia/Jakarta";
export const APP_LOCALE = "id-ID";
