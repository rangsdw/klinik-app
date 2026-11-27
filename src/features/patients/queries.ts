import "server-only";
import { cookies } from "next/headers";
import type { PharmacyStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/date";

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
  if (!accountUserId) return [];
  return db.patient.findMany({
    where: activePatientWhere({ accountUserId }),
    select: patientSelect,
    orderBy: [{ isSelf: "desc" }, { createdAt: "asc" }],
  });
}

export async function countPatientsForAccount(accountUserId: string): Promise<number> {
  if (!accountUserId) return 0;
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
  if (!accountUserId || !patientId) return null;
  return db.patient.findFirst({
    where: activePatientWhere({ id: patientId, accountUserId }),
    select: patientSelect,
  });
}

export async function getSelfPatient(accountUserId: string): Promise<PatientView | null> {
  if (!accountUserId) return null;
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
  if (!accountUserId) return null;
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

export type PatientVisitPrescription = {
  id: string;
  medicineName: string;
  dosageForm: string;
  unit: string;
  quantity: number;
  dosageInstructions: string;
  notes: string | null;
};

export type PatientVisitHistoryItem = {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  doctorName: string;
  chiefComplaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  bloodPressure: string | null;
  bodyTemperature: number | null;
  bodyWeight: number | null;
  pulseRate: number | null;
  pharmacyStatus: PharmacyStatus;
  dispensedAt: string | null;
  prescriptions: PatientVisitPrescription[];
};

/**
 * Riwayat kunjungan selesai beserta ringkasan pemeriksaan dokter dan resep obat
 * untuk satu pasien milik akun yang sedang login.
 */
export async function listMedicalHistoryForPatient(
  accountUserId: string,
  patientId: string,
): Promise<PatientVisitHistoryItem[]> {
  if (!accountUserId || !patientId) return [];

  const rows = await db.medicalRecord.findMany({
    where: {
      patient: activePatientWhere({ id: patientId, accountUserId }),
      appointment: { status: "COMPLETED" },
    },
    select: {
      id: true,
      subjective: true,
      objective: true,
      assessment: true,
      plan: true,
      bloodPressure: true,
      bodyTemperature: true,
      bodyWeight: true,
      pulseRate: true,
      pharmacyStatus: true,
      pharmacyDispensedAt: true,
      doctor: { select: { name: true } },
      appointment: {
        select: {
          appointmentDate: true,
          startTime: true,
          endTime: true,
          chiefComplaint: true,
        },
      },
      prescriptions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          dosageInstructions: true,
          notes: true,
          medicine: {
            select: { name: true, dosageForm: true, unit: true },
          },
        },
      },
    },
    orderBy: [{ appointment: { appointmentDate: "desc" } }, { createdAt: "desc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    appointmentDate: toDateInput(r.appointment.appointmentDate),
    startTime: r.appointment.startTime,
    endTime: r.appointment.endTime,
    doctorName: r.doctor.name,
    chiefComplaint: r.appointment.chiefComplaint,
    subjective: r.subjective,
    objective: r.objective,
    assessment: r.assessment,
    plan: r.plan,
    bloodPressure: r.bloodPressure,
    bodyTemperature: r.bodyTemperature,
    bodyWeight: r.bodyWeight,
    pulseRate: r.pulseRate,
    pharmacyStatus: r.pharmacyStatus,
    dispensedAt: r.pharmacyDispensedAt ? r.pharmacyDispensedAt.toISOString() : null,
    prescriptions: r.prescriptions.map((p) => ({
      id: p.id,
      medicineName: p.medicine.name,
      dosageForm: p.medicine.dosageForm,
      unit: p.medicine.unit,
      quantity: p.quantity,
      dosageInstructions: p.dosageInstructions,
      notes: p.notes,
    })),
  }));
}
