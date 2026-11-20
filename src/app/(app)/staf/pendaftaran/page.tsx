import type { Metadata } from "next";
import { CalendarClock, CalendarDays } from "lucide-react";
import { requireStaffType } from "@/lib/rbac";
import { PageHeader } from "@/components/ui-kit/page-header";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDoctorOptions, getDoctorSchedules } from "@/features/appointments/queries";
import { SchedulesPanel } from "@/features/appointments/components/schedules-panel";

export const metadata: Metadata = { title: "Pendaftaran" };

export default async function RegistrationPage() {
  await requireStaffType("REGISTRATION");
  const [schedules, doctors] = await Promise.all([getDoctorSchedules(), getDoctorOptions()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pendaftaran"
        description="Kelola sesi jadwal praktik dokter, kuota pasien, dan permintaan janji temu."
      />

      <Tabs defaultValue="jadwal" className="space-y-6">
        <TabsList>
          <TabsTrigger value="jadwal">
            <CalendarDays aria-hidden="true" className="size-4" />
            Jadwal Dokter
          </TabsTrigger>
          <TabsTrigger value="permintaan">
            <CalendarClock aria-hidden="true" className="size-4" />
            Permintaan Janji
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jadwal">
          <SchedulesPanel schedules={schedules} doctors={doctors} />
        </TabsContent>

        <TabsContent value="permintaan">
          <EmptyState
            icon={CalendarClock}
            title="Segera hadir"
            description="Daftar permintaan janji temu pasien (approve, reject, dan reschedule) akan tersedia di tab ini."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
