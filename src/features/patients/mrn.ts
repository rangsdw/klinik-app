import type { Prisma } from "@prisma/client";

/**
 * Nomor rekam medis (pure, tanpa server-only) agar bisa dipakai service, seeder, dan test.
 */

/** Format nomor RM: RM-YYYY-000001 */
export function formatMedicalRecordNumber(year: number, sequence: number): string {
  return `RM-${year}-${String(sequence).padStart(6, "0")}`;
}

/** Tahun berjalan menurut zona Asia/Jakarta. */
export function jakartaYear(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(now),
  );
}

type CounterTx = Pick<Prisma.TransactionClient, "$executeRaw" | "$queryRaw">;

/**
 * Nomor RM berikutnya, aman dari race condition. Satu statement atomik MySQL
 * (INSERT ... ON DUPLICATE KEY UPDATE) membuat atau menaikkan counter dan mengunci barisnya
 * sampai transaksi selesai, lalu nilainya dibaca di transaksi yang sama.
 */
export async function generateMedicalRecordNumber(
  tx: CounterTx,
  now: Date = new Date(),
): Promise<string> {
  const year = jakartaYear(now);
  const key = `rm-${year}`;
  await tx.$executeRaw`INSERT INTO counters (\`key\`, value) VALUES (${key}, 1) ON DUPLICATE KEY UPDATE value = value + 1`;
  const rows = await tx.$queryRaw<
    { value: number }[]
  >`SELECT value FROM counters WHERE \`key\` = ${key}`;
  const value = Number(rows[0]?.value);
  if (!Number.isFinite(value)) throw new Error("Gagal membuat nomor rekam medis");
  return formatMedicalRecordNumber(year, value);
}
