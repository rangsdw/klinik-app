import type { Metadata } from "next";
import { requireRole } from "@/lib/rbac";
import {
  getDoctorAppointments,
  getDoctorStats,
  getMedicinesList,
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

  // Format YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];
  const currentDate = params.date || todayStr;

  const [appointments, stats, medicines] = await Promise.all([
    getDoctorAppointments(user.id, currentDate),
    getDoctorStats(user.id, currentDate),
    getMedicinesList(),
  ]);

  return (
    <DoctorAppointmentView
      doctorName={user.name}
      currentDate={currentDate}
      stats={stats}
      appointments={appointments}
      availableMedicines={medicines}
    />
  );
}
