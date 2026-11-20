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

/** Tanggal hari ini dalam zona waktu Asia/Jakarta ("YYYY-MM-DD"). */
export function jakartaTodayStr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Ubah "YYYY-MM-DD" menjadi Date UTC tengah malam (cocok dengan kolom MySQL DATE). */
export function parseDateOnlyUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Tambah N hari ke string tanggal "YYYY-MM-DD" dan kembalikan "YYYY-MM-DD". */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const date = parseDateOnlyUtc(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Ambil hari dalam seminggu (0 = Minggu .. 6 = Sabtu) dari "YYYY-MM-DD". */
export function dayOfWeekFromDateStr(dateStr: string): number {
  return parseDateOnlyUtc(dateStr).getUTCDay();
}
