import type { Metadata } from "next";
import { requireStaffType } from "@/lib/rbac";
import { PageHeader } from "@/components/ui-kit/page-header";
import { getCheckInDashboardData } from "@/features/appointments/queries";
import { StaffCheckInView } from "@/features/appointments/components/staff-checkin-view";

export const metadata: Metadata = { title: "Check-in Pasien" };

export default async function StaffCheckInPage() {
  await requireStaffType("REGISTRATION");
  const { stats, recentCheckIns } = await getCheckInDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-in Pasien"
        description="Pindai QR Code pasien atau cari manual untuk mencatat kedatangan janji hari ini."
      />

      <StaffCheckInView stats={stats} recentCheckIns={recentCheckIns} />
    </div>
  );
}
