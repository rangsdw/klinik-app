"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { normalizeEmail, normalizeName, normalizePhone } from "@/lib/normalize";
import { firstErrors, type ActionResult } from "@/lib/action-result";
import { MAX_FAMILY_MEMBERS } from "@/config/clinic";
import {
  changePasswordSchema,
  familyMemberSchema,
  profileSchema,
  type ChangePasswordInput,
  type FamilyMemberInput,
  type ProfileInput,
} from "@/features/patients/schemas";
import {
  ACTIVE_PATIENT_COOKIE,
  activePatientWhere,
  getOwnedPatient,
} from "@/features/patients/queries";
import {
  addFamilyMember,
  BCRYPT_COST,
  FamilyLimitError,
  normalizeMemberInput,
  uniqueFieldFromError,
} from "@/features/patients/service";

/** Pilih pasien aktif. ID dari klien SELALU divalidasi kepemilikannya. */
export async function setActivePatientAction(patientId: string): Promise<ActionResult> {
  const user = await requireRole("PATIENT");
  const patient = await getOwnedPatient(user.id, patientId);
  if (!patient) return { ok: false, message: "Pasien tidak ditemukan." };
  const store = await cookies();
  store.set(ACTIVE_PATIENT_COOKIE, patient.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  revalidatePath("/pasien", "layout");
  return { ok: true, message: `Pasien aktif: ${patient.name}` };
}

function uniqueError(error: unknown): ActionResult | null {
  const field = uniqueFieldFromError(error);
  if (field === "nik") return { ok: false, fieldErrors: { nik: "NIK ini sudah terdaftar." } };
  if (field) return { ok: false, message: "Data sudah terdaftar." };
  return null;
}

export async function addFamilyMemberAction(
  input: FamilyMemberInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("PATIENT");
  const parsed = familyMemberSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  if (parsed.data.relationship === "SELF") {
    return { ok: false, fieldErrors: { relationship: "Pilih hubungan dengan pemilik akun" } };
  }
  try {
    const patient = await addFamilyMember(user.id, parsed.data);
    revalidatePath("/pasien", "layout");
    return {
      ok: true,
      message: `${patient.name} ditambahkan (${patient.medicalRecordNumber}).`,
      data: { id: patient.id },
    };
  } catch (error) {
    if (error instanceof FamilyLimitError) {
      return {
        ok: false,
        message: `Batas maksimal ${MAX_FAMILY_MEMBERS} anggota per akun sudah tercapai.`,
      };
    }
    const u = uniqueError(error);
    if (u) return u;
    throw error;
  }
}

export async function updatePatientAction(
  patientId: string,
  input: FamilyMemberInput,
): Promise<ActionResult> {
  const user = await requireRole("PATIENT");
  const existing = await getOwnedPatient(user.id, patientId);
  if (!existing) notFound();

  const parsed = familyMemberSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };

  // Hubungan pasien "diri sendiri" tidak bisa diubah, dan anggota lain tidak boleh menjadi SELF.
  const relationship = existing.isSelf ? "SELF" : parsed.data.relationship;
  if (!existing.isSelf && relationship === "SELF") {
    return { ok: false, fieldErrors: { relationship: "Pilih hubungan dengan pemilik akun" } };
  }
  try {
    await db.patient.update({
      where: { id: existing.id },
      data: { ...normalizeMemberInput({ ...parsed.data, relationship }) },
    });
  } catch (error) {
    const u = uniqueError(error);
    if (u) return u;
    throw error;
  }
  revalidatePath("/pasien", "layout");
  return { ok: true, message: "Data pasien diperbarui." };
}

/** Soft delete anggota keluarga (bukan pasien diri sendiri). */
export async function deletePatientAction(patientId: string): Promise<ActionResult> {
  const user = await requireRole("PATIENT");
  const existing = await getOwnedPatient(user.id, patientId);
  if (!existing) notFound();
  if (existing.isSelf) return { ok: false, message: "Data diri sendiri tidak bisa dihapus." };

  // TODO(Ravy, modul rekam medis): tolak penghapusan bila pasien sudah punya data kunjungan/rekam medis.
  await db.patient.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });

  const store = await cookies();
  if (store.get(ACTIVE_PATIENT_COOKIE)?.value === existing.id) store.delete(ACTIVE_PATIENT_COOKIE);
  revalidatePath("/pasien", "layout");
  redirect("/pasien/keluarga?dihapus=1");
}

// ---------------------------------------------------------------------------
// Profil akun pasien
// ---------------------------------------------------------------------------

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  const user = await requireRole("PATIENT");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };

  const name = normalizeName(parsed.data.name);
  const phone = normalizePhone(parsed.data.phone);
  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { name, email: normalizeEmail(parsed.data.email), phone },
      });
      if (parsed.data.syncPatient) {
        await tx.patient.updateMany({
          where: activePatientWhere({ accountUserId: user.id, isSelf: true }),
          data: { name, phone },
        });
      }
    });
  } catch (error) {
    const field = uniqueFieldFromError(error);
    if (field === "email")
      return { ok: false, fieldErrors: { email: "Email ini sudah dipakai akun lain." } };
    if (field === "phone")
      return { ok: false, fieldErrors: { phone: "No. HP ini sudah dipakai akun lain." } };
    throw error;
  }
  revalidatePath("/pasien", "layout");
  return { ok: true, message: "Profil diperbarui. Nama baru tampil setelah Anda masuk ulang." };
}

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  const user = await requireRole("PATIENT");
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };

  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await bcrypt.compare(parsed.data.currentPassword, row.passwordHash))) {
    return { ok: false, fieldErrors: { currentPassword: "Password lama tidak sesuai." } };
  }
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, BCRYPT_COST) },
  });
  return { ok: true, message: "Password berhasil diganti." };
}
