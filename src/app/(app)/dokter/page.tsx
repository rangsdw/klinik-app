import type { Metadata } from "next";
import { requireRole } from "@/lib/rbac";
import { jakartaTodayStr } from "@/lib/date";
import {
  getDoctorAppointments,
  getDoctorStats,
} from "@/features/doctor/queries";
import { DoctorAppointmentView } from "@/features/doctor/components/doctor-appointment-view";

export const metadata: Metadata = { title: "Dashboard & Janji Dokter" };

export default async function DoctorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireRole("DOCTOR");
  const params = await searchParams;

  // Format YYYY-MM-DD (WIB)
  const todayStr = jakartaTodayStr();
  const currentDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayStr;

  const [appointments, stats] = await Promise.all([
    getDoctorAppointments(user.id, currentDate),
    getDoctorStats(user.id, currentDate),
  ]);

  return (
    <DoctorAppointmentView
      doctorName={user.name}
      currentDate={currentDate}
      stats={stats}
      appointments={appointments}
    />
  );
}
