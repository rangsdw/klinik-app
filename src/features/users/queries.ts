import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { UserListParams } from "@/features/users/schemas";

export const USERS_PAGE_SIZE = 10;

/** Kolom user yang aman dikirim ke UI (tanpa passwordHash). */
export const userListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  staffType: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type UserRow = Prisma.UserGetPayload<{ select: typeof userListSelect }>;

export async function listUsers(params: UserListParams) {
  const page = params.page ?? 1;
  const where: Prisma.UserWhereInput = {
    ...(params.role ? { role: params.role } : {}),
    ...(params.q
      ? { OR: [{ name: { contains: params.q } }, { email: { contains: params.q } }] }
      : {}),
  };
  const [total, rows] = await db.$transaction([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: userListSelect,
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
    }),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)) };
}

export async function countUsersByRole() {
  const grouped = await db.user.groupBy({
    by: ["role"],
    _count: { _all: true },
    where: { isActive: true },
  });
  const out = { ADMIN: 0, DOCTOR: 0, STAFF: 0, PATIENT: 0 };
  for (const g of grouped) out[g.role] = g._count._all;
  return out;
}
