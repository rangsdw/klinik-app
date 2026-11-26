import "server-only";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RoleName, StaffTypeName } from "@/lib/roles";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: RoleName;
  staffType: StaffTypeName | null;
};

/**
 * Ambil user yang login beserta status terbaru dari database (role, staffType, isActive).
 * Di-cache per request. Akun yang dinonaktifkan di tengah sesi atau sesi lama yang user-nya
 * tidak ditemukan di DB langsung dikeluarkan lewat /keluar agar cookie dibersihkan.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      staffType: true,
      isActive: true,
    },
  });
  if (!user) redirect("/keluar?alasan=sesi");
  if (!user.isActive) redirect("/keluar?alasan=nonaktif");
  const { isActive: _ignored, ...rest } = user;
  void _ignored;
  return rest;
});

/** Wajib login. Belum login -> /masuk. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  return user;
}

/** Wajib salah satu role. Pelanggaran -> halaman 403 (app/forbidden.tsx). */
export async function requireRole(...roles: RoleName[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) forbidden();
  return user;
}

/** Wajib role STAFF dengan staffType tertentu. */
export async function requireStaffType(...types: StaffTypeName[]): Promise<CurrentUser> {
  const user = await requireRole("STAFF");
  if (!user.staffType || !types.includes(user.staffType)) forbidden();
  return user;
}

export { hasRole, hasStaffType } from "@/lib/roles";

/** Untuk Route Handler: kembalikan Response 401/403, atau user bila lolos. */
export async function apiRequireRole(
  ...roles: RoleName[]
): Promise<{ user: CurrentUser; response?: never } | { user?: never; response: Response }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { response: Response.json({ error: "Belum masuk" }, { status: 401 }) };
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      staffType: true,
      isActive: true,
    },
  });
  if (!user || !user.isActive || !roles.includes(user.role)) {
    return { response: Response.json({ error: "Akses ditolak" }, { status: 403 }) };
  }
  const { isActive: _ignored, ...rest } = user;
  void _ignored;
  return { user: rest };
}
