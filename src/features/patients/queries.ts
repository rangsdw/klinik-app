import "server-only";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const ACTIVE_PATIENT_COOKIE = "active_patient_id";

/**
 * SATU-SATUNYA tempat filter soft delete pasien. Semua query pasien memakai helper ini.
 */
export function activePatientWhere(where: Prisma.PatientWhereInput = {}): Prisma.PatientWhereInput {
  return { ...where, deletedAt: null };
}

/** Kolom pasien yang aman dikirim ke UI portal. */
export const patientSelect = {
  id: true,
  medicalRecordNumber: true,
  nik: true,
  name: true,
  birthDate: true,
  gender: true,
  bloodType: true,
  phone: true,
  address: true,
  relationship: true,
  allergies: true,
  specialConditions: true,
  qrToken: true,
  isSelf: true,
  createdAt: true,
} satisfies Prisma.PatientSelect;

export type PatientView = Prisma.PatientGetPayload<{ select: typeof patientSelect }>;

/** Semua pasien milik akun (diri sendiri dulu, lalu urut nama). */
export async function listPatientsForAccount(accountUserId: string): Promise<PatientView[]> {
  return db.patient.findMany({
    where: activePatientWhere({ accountUserId }),
    select: patientSelect,
    orderBy: [{ isSelf: "desc" }, { createdAt: "asc" }],
  });
}

export async function countPatientsForAccount(accountUserId: string): Promise<number> {
  return db.patient.count({ where: activePatientWhere({ accountUserId }) });
}

/**
 * Ambil satu pasien HANYA bila milik akun tersebut. Mengembalikan null untuk pasien akun lain
 * (pemanggil merender notFound). Jangan pernah percaya ID dari klien.
 */
export async function getOwnedPatient(
  accountUserId: string,
  patientId: string,
): Promise<PatientView | null> {
  if (!patientId) return null;
  return db.patient.findFirst({
    where: activePatientWhere({ id: patientId, accountUserId }),
    select: patientSelect,
  });
}

export async function getSelfPatient(accountUserId: string): Promise<PatientView | null> {
  return db.patient.findFirst({
    where: activePatientWhere({ accountUserId, isSelf: true }),
    select: patientSelect,
  });
}

/**
 * Pasien aktif dari cookie httpOnly, divalidasi kepemilikannya di server.
 * Fallback ke pasien isSelf (lalu pasien pertama) bila cookie kosong/tidak valid.
 */
export async function getActivePatient(accountUserId: string): Promise<PatientView | null> {
  const store = await cookies();
  const fromCookie = store.get(ACTIVE_PATIENT_COOKIE)?.value;
  if (fromCookie) {
    const owned = await getOwnedPatient(accountUserId, fromCookie);
    if (owned) return owned;
  }
  return (
    (await getSelfPatient(accountUserId)) ??
    (await db.patient.findFirst({
      where: activePatientWhere({ accountUserId }),
      select: patientSelect,
      orderBy: { createdAt: "asc" },
    }))
  );
}
