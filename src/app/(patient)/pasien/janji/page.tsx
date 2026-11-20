import type { Metadata } from "next";
import { requireRole } from "@/lib/rbac";
import { addDaysToDateStr, jakartaTodayStr } from "@/lib/date";
import { PageHeader } from "@/components/ui-kit/page-header";
import { getActivePatient, listPatientsForAccount } from "@/features/patients/queries";
import {
  getAvailableSessionsForDate,
  getDoctorOptions,
  getPublicDoctorSchedules,
  listAppointmentsForAccount,
} from "@/features/appointments/queries";
import { MAX_BOOKING_DAYS_AHEAD } from "@/features/appointments/schemas";
import { PatientBookingView } from "@/features/appointments/components/patient-booking-view";

export const metadata: Metadata = { title: "Buat janji" };

export default async function PatientAppointmentPage() {
  const user = await requireRole("PATIENT");
  const todayStr = jakartaTodayStr();
  const maxDateStr = addDaysToDateStr(todayStr, MAX_BOOKING_DAYS_AHEAD);

  const [patients, activePatient, doctors, doctorSchedules, appointments] = await Promise.all([
    listPatientsForAccount(user.id),
    getActivePatient(user.id),
    getDoctorOptions(),
    getPublicDoctorSchedules(),
    listAppointmentsForAccount(user.id),
  ]);

  const initialDoctorId = doctors[0]?.id ?? "";
  const initialSessions = initialDoctorId
    ? await getAvailableSessionsForDate(initialDoctorId, todayStr)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Janji temu"
        description="Pilih dokter, tanggal, dan sesi praktik yang kuotanya masih tersedia."
      />

      <PatientBookingView
        patients={patients}
        activePatient={activePatient}
        doctors={doctors}
        doctorSchedules={doctorSchedules}
        initialDoctorId={initialDoctorId}
        initialDate={todayStr}
        todayStr={todayStr}
        maxDateStr={maxDateStr}
        initialSessions={initialSessions}
        appointments={appointments}
      />
    </div>
  );
}
