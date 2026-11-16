import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role, StaffType } from "@prisma/client";
import { db } from "@/lib/db";
import { emptyToUndefined, normalizeEmail, normalizeName, normalizePhone } from "@/lib/normalize";
import { BCRYPT_COST } from "@/features/patients/service";
import type { InternalUserInput } from "@/features/users/schemas";

export class UserRuleError extends Error {}

/** Password sementara yang mudah dibaca/diketik (tanpa karakter mirip: 0/O, 1/l). */
export function generateTemporaryPassword(length = 10): string {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = letters + letters.toUpperCase() + digits;
  const chars = [letters[randomInt(letters.length)]!, digits[randomInt(digits.length)]!];
  while (chars.length < length) chars.push(all[randomInt(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/** staffType wajib bila STAFF, dan dikosongkan untuk role lain. */
export function resolveStaffType(role: Role, staffType?: string | null): StaffType | null {
  if (role !== "STAFF") return null;
  if (!staffType) throw new UserRuleError("Tipe staf wajib dipilih untuk role Staf");
  return staffType as StaffType;
}

function toData(input: InternalUserInput) {
  const phone = emptyToUndefined(input.phone);
  return {
    name: normalizeName(input.name),
    email: normalizeEmail(input.email),
    phone: phone ? normalizePhone(phone) : null,
    role: input.role as Role,
    staffType: resolveStaffType(input.role as Role, input.staffType),
  };
}

/** Buat akun internal. Mengembalikan password sementara (ditampilkan sekali ke admin). */
export async function createInternalUser(input: InternalUserInput) {
  const temporaryPassword = generateTemporaryPassword();
  const user = await db.user.create({
    data: { ...toData(input), passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_COST) },
    select: { id: true, name: true },
  });
  return { user, temporaryPassword };
}

/** Ubah akun internal. Admin tidak boleh mengubah role dirinya sendiri. */
export async function updateInternalUser(
  actorId: string,
  userId: string,
  input: InternalUserInput,
) {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) throw new UserRuleError("Akun tidak ditemukan");
  if (target.role === "PATIENT") throw new UserRuleError("Akun pasien tidak dikelola di menu ini");
  const data = toData(input);
  if (actorId === userId && data.role !== target.role) {
    throw new UserRuleError("Anda tidak bisa mengubah role akun Anda sendiri");
  }
  return db.user.update({ where: { id: userId }, data, select: { id: true, name: true } });
}

/** Aktif/nonaktifkan akun. Tidak boleh menonaktifkan diri sendiri. */
export async function setUserActive(actorId: string, userId: string, isActive: boolean) {
  if (actorId === userId && !isActive)
    throw new UserRuleError("Anda tidak bisa menonaktifkan akun Anda sendiri");
  return db.user.update({
    where: { id: userId },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });
}

/** Reset password oleh admin: kembalikan password sementara (ditampilkan sekali). */
export async function resetPasswordByAdmin(userId: string) {
  const temporaryPassword = generateTemporaryPassword();
  const user = await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_COST) },
    select: { id: true, name: true },
  });
  return { user, temporaryPassword };
}
