import "server-only";
import { db } from "@/lib/db";
import { ageLabel } from "@/lib/date";
import { activePatientWhere } from "@/features/patients/queries";

/** Ringkasan pasien minimum untuk layar pendaftaran/check-in staf (tanpa data medis). */
export type StaffPatientSummary = {
  id: string;
  name: string;
  medicalRecordNumber: string;
  ageLabel: string;
};

const staffPatientSelect = {
  id: true,
  name: true,
  medicalRecordNumber: true,
  birthDate: true,
} as const;

function toSummary(row: {
  id: string;
  name: string;
  medicalRecordNumber: string;
  birthDate: Date;
}): StaffPatientSummary {
  return {
    id: row.id,
    name: row.name,
    medicalRecordNumber: row.medicalRecordNumber,
    ageLabel: ageLabel(row.birthDate),
  };
}

/** Cari pasien aktif berdasarkan token QR untuk check-in staf. */
export async function findPatientByQrTokenForStaff(
  token: string,
): Promise<StaffPatientSummary | null> {
  if (!token) return null;
  const row = await db.patient.findFirst({
    where: activePatientWhere({ qrToken: token }),
    select: staffPatientSelect,
  });
  return row ? toSummary(row) : null;
}

/** Cari pasien aktif berdasarkan ID untuk keperluan staf (tanpa data medis). */
export async function findPatientByIdForStaff(
  patientId: string,
): Promise<StaffPatientSummary | null> {
  if (!patientId) return null;
  const row = await db.patient.findFirst({
    where: activePatientWhere({ id: patientId }),
    select: staffPatientSelect,
  });
  return row ? toSummary(row) : null;
}

/**
 * Pencarian pasien khusus staf pendaftaran berdasarkan No. RM, nama, NIK, atau No. HP.
 * Mengembalikan hanya field minimum (tanpa alergi, kondisi khusus, maupun token QR).
 */
export async function searchPatientsForStaff(
  query: string,
  limit = 10,
): Promise<StaffPatientSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const rows = await db.patient.findMany({
    where: activePatientWhere({
      OR: [
        { medicalRecordNumber: { contains: trimmed } },
        { name: { contains: trimmed } },
        { nik: { contains: trimmed } },
        { phone: { contains: trimmed } },
      ],
    }),
    select: staffPatientSelect,
    orderBy: { name: "asc" },
    take: limit,
  });

  return rows.map(toSummary);
}
