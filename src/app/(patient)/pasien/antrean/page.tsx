import type { Metadata } from "next";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui-kit/page-header";
import { getPatientLiveQueueData } from "@/features/appointments/queries";
import { PatientLiveQueueView } from "@/features/appointments/components/patient-live-queue-view";

export const metadata: Metadata = { title: "Antrean saya" };

export default async function PatientLiveQueuePage() {
  const user = await requireRole("PATIENT");
  const initialData = await getPatientLiveQueueData(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Antrean saya"
        description="Pantau nomor antrean yang sedang dipanggil dan posisi Anda hari ini."
      />

      <PatientLiveQueueView initialData={initialData} />
    </div>
  );
}
