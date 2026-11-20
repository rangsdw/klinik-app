export type TimeSlot = {
  id?: string;
  startTime: string;
  endTime: string;
};

export class ScheduleOverlapError extends Error {
  constructor(message = "Sesi tumpang tindih dengan jadwal aktif lain pada dokter dan hari yang sama.") {
    super(message);
    this.name = "ScheduleOverlapError";
  }
}

/** Ubah "HH:mm" menjadi total menit sejak 00:00. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Dua sesi tumpang tindih jika interval [start, end) saling beririsan. */
export function schedulesOverlap(a: TimeSlot, b: TimeSlot): boolean {
  const startA = timeToMinutes(a.startTime);
  const endA = timeToMinutes(a.endTime);
  const startB = timeToMinutes(b.startTime);
  const endB = timeToMinutes(b.endTime);
  return startA < endB && startB < endA;
}

/** Cari slot yang bentrok dengan input; kembalikan slot pertama yang bentrok atau null. */
export function findOverlappingSlot<T extends TimeSlot>(
  input: TimeSlot,
  existingSlots: T[],
  excludeId?: string,
): T | null {
  for (const slot of existingSlots) {
    if (excludeId && slot.id === excludeId) continue;
    if (schedulesOverlap(input, slot)) return slot;
  }
  return null;
}

/**
 * Validasi aturan bisnis sesi jadwal di server/service:
 * - Jam selesai harus setelah jam mulai
 * - Kuota minimal 1
 * - Tidak tumpang tindih dengan sesi lain pada dokter dan hari yang sama
 */
export function assertValidScheduleSlot(
  input: { startTime: string; endTime: string; quota: number },
  existingSlots: TimeSlot[],
  excludeId?: string,
): void {
  if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
    throw new Error("Jam selesai harus setelah jam mulai.");
  }
  if (!Number.isInteger(input.quota) || input.quota < 1) {
    throw new Error("Kuota minimal 1 pasien.");
  }
  const conflict = findOverlappingSlot(input, existingSlots, excludeId);
  if (conflict) {
    throw new ScheduleOverlapError(
      `Bentrok dengan sesi ${conflict.startTime}–${conflict.endTime} pada dokter dan hari yang sama.`,
    );
  }
}
