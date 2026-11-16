import { differenceInYears, format } from "date-fns";
import { id } from "date-fns/locale";

/** Format tampil: "16 Nov 2026". */
export function formatDate(date: Date | string): string {
  return format(new Date(date), "d MMM yyyy", { locale: id });
}

/** Umur dalam tahun (berdasarkan tanggal hari ini). */
export function ageOf(birthDate: Date | string, now: Date = new Date()): number {
  return differenceInYears(now, new Date(birthDate));
}

export function ageLabel(birthDate: Date | string): string {
  const years = ageOf(birthDate);
  if (years < 1) return "di bawah 1 tahun";
  return `${years} tahun`;
}

/** Date -> "yyyy-MM-dd" untuk input type="date" (tanggal lahir disimpan UTC tengah malam). */
export function toDateInput(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** Nama depan untuk sapaan. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
