import type { Metadata } from "next";
import { requireStaffType } from "@/lib/rbac";
import { PageHeader } from "@/components/ui-kit/page-header";
import { getStaffQueueBoardData } from "@/features/appointments/queries";
import { StaffQueueBoardView } from "@/features/appointments/components/staff-queue-board-view";

export const metadata: Metadata = { title: "Antrean Hari Ini" };

export default async function StaffQueueBoardPage() {
  await requireStaffType("REGISTRATION");
  const initialData = await getStaffQueueBoardData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Antrean Hari Ini"
        description="Pantau antrean per dokter, panggil pasien berikutnya, dan kelola kehadiran pasien."
      />

      <StaffQueueBoardView initialData={initialData} />
    </div>
  );
}
