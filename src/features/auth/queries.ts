import "server-only";
import { db } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";

/** Cari user berdasarkan email atau no. HP (dipakai saat login). Termasuk passwordHash: JANGAN kirim ke klien. */
export async function findUserByIdentifier(identifier: string) {
  const value = identifier.trim();
  const where = value.includes("@")
    ? { email: normalizeEmail(value) }
    : { phone: normalizePhone(value) };
  return db.user.findUnique({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      staffType: true,
      isActive: true,
      passwordHash: true,
    },
  });
}
