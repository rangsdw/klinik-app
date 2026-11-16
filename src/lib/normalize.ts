/**
 * Normalisasi input di satu tempat. Dipakai skema Zod (lewat .transform) dan service.
 */

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * No. HP Indonesia ke format 08xx.
 * "+62 812-3456-7890" | "62812..." | "812..." | "0812..." -> "081234567890"
 */
export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("62")) digits = "0" + digits.slice(2);
  else if (digits.startsWith("8")) digits = "0" + digits;
  return digits;
}

/** NIK: hanya digit. */
export function normalizeNik(value: string): string {
  return value.replace(/\D/g, "");
}

/** Nama ke Title Case: "  budi   SANTOSO " -> "Budi Santoso". Menjaga apostrof & tanda hubung. */
export function normalizeName(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** String kosong -> undefined (untuk field opsional). */
export function emptyToUndefined<T>(value: T): T | undefined {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export function isIndonesianPhone(value: string): boolean {
  return /^08\d{8,12}$/.test(value);
}
