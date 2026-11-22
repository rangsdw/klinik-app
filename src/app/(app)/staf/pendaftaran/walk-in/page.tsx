import type { Metadata } from "next";
import { requireStaffType } from "@/lib/rbac";
import { clinicConfig } from "@/config/clinic";
import { PageHeader } from "@/components/ui-kit/page-header";
import { findPatientByIdForStaff } from "@/features/patients/staff-queries";
import { getTodayWalkInSessions } from "@/features/appointments/queries";
import { StaffWalkInView } from "@/features/appointments/components/staff-walkin-view";

export const metadata: Metadata = { title: "Antrean Walk-in" };

export default async function StaffWalkInPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  await requireStaffType("REGISTRATION");
  const { patientId } = await searchParams;

  const [sessions, preselectedPatient] = await Promise.all([
    getTodayWalkInSessions(),
    patientId ? findPatientByIdForStaff(patientId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Antrean Walk-in"
        description="Daftarkan pasien yang datang langsung tanpa janji ke sesi dokter hari ini."
      />

      <StaffWalkInView
        sessions={sessions}
        preselectedPatient={preselectedPatient}
        clinicName={clinicConfig.name}
        clinicAddress={clinicConfig.address}
        clinicPhone={clinicConfig.phone}
      />
    </div>
  );
}
