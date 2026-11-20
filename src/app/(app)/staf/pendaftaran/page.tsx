import type { Metadata } from "next";
import { CalendarClock, CalendarDays } from "lucide-react";
import { requireStaffType } from "@/lib/rbac";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getDoctorOptions,
  getDoctorSchedules,
  getStaffAppointmentRequestsData,
} from "@/features/appointments/queries";
import { SchedulesPanel } from "@/features/appointments/components/schedules-panel";
import { AppointmentRequestsPanel } from "@/features/appointments/components/appointment-requests-panel";

export const metadata: Metadata = { title: "Pendaftaran" };

export default async function RegistrationPage() {
  await requireStaffType("REGISTRATION");
  const [schedules, doctors, requestsData] = await Promise.all([
    getDoctorSchedules(),
    getDoctorOptions(),
    getStaffAppointmentRequestsData(),
  ]);

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
            {requestsData.stats.pendingCount > 0 ? (
              <span className="bg-primary-700 text-surface ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold">
                {requestsData.stats.pendingCount}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jadwal">
          <SchedulesPanel schedules={schedules} doctors={doctors} />
        </TabsContent>

        <TabsContent value="permintaan">
          <AppointmentRequestsPanel
            requests={requestsData.requests}
            stats={requestsData.stats}
            doctors={doctors}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
