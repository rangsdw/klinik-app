"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { firstErrors, type ActionResult } from "@/lib/action-result";
import { uniqueFieldFromError } from "@/features/patients/service";
import { internalUserSchema, type InternalUserInput } from "@/features/users/schemas";
import {
  createInternalUser,
  resetPasswordByAdmin,
  setUserActive,
  updateInternalUser,
  UserRuleError,
} from "@/features/users/service";

function handle(error: unknown): ActionResult<never> {
  if (error instanceof UserRuleError) return { ok: false, message: error.message };
  const field = uniqueFieldFromError(error);
  if (field === "email") return { ok: false, fieldErrors: { email: "Email ini sudah terdaftar." } };
  if (field === "phone")
    return { ok: false, fieldErrors: { phone: "No. HP ini sudah terdaftar." } };
  throw error;
}

export async function createInternalUserAction(
  input: InternalUserInput,
): Promise<ActionResult<{ temporaryPassword: string; name: string }>> {
  await requireRole("ADMIN");
  const parsed = internalUserSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  try {
    const { user, temporaryPassword } = await createInternalUser(parsed.data);
    revalidatePath("/admin/pengguna");
    return {
      ok: true,
      message: `Akun ${user.name} dibuat.`,
      data: { temporaryPassword, name: user.name },
    };
  } catch (error) {
    return handle(error);
  }
}

export async function updateInternalUserAction(
  userId: string,
  input: InternalUserInput,
): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  const parsed = internalUserSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  try {
    const user = await updateInternalUser(admin.id, userId, parsed.data);
    revalidatePath("/admin/pengguna");
    return { ok: true, message: `Akun ${user.name} diperbarui.` };
  } catch (error) {
    return handle(error);
  }
}

export async function setUserActiveAction(
  userId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const admin = await requireRole("ADMIN");
  try {
    const user = await setUserActive(admin.id, userId, isActive);
    revalidatePath("/admin/pengguna");
    return {
      ok: true,
      message: `Akun ${user.name} ${user.isActive ? "diaktifkan" : "dinonaktifkan"}.`,
    };
  } catch (error) {
    return handle(error);
  }
}

export async function resetPasswordByAdminAction(
  userId: string,
): Promise<ActionResult<{ temporaryPassword: string; name: string }>> {
  await requireRole("ADMIN");
  const { user, temporaryPassword } = await resetPasswordByAdmin(userId);
  return {
    ok: true,
    message: `Password ${user.name} direset.`,
    data: { temporaryPassword, name: user.name },
  };
}
