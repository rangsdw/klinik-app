import type { Metadata } from "next";
import { requireRole } from "@/lib/rbac";
import { getPatientsWithHistory } from "@/features/doctor/queries";
import { PatientHistoryViewer } from "@/features/doctor/components/patient-history-viewer";

export const metadata: Metadata = { title: "Daftar Pasien · Dokter" };

export default async function DoctorPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole("DOCTOR");
  const params = await searchParams;
  const searchQuery = params.q || "";

  const patients = await getPatientsWithHistory(searchQuery);

  return <PatientHistoryViewer initialPatients={patients} searchQuery={searchQuery} />;
}
