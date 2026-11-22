import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import {
  getAppointmentForExamination,
  getMedicinesList,
} from "@/features/doctor/queries";
import { ExaminationForm } from "@/features/doctor/components/examination-form";

export const metadata: Metadata = { title: "Pemeriksaan Medis & E-Resep · Dokter" };

export default async function DoctorExaminationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireRole("DOCTOR");
  const { id } = await params;
  const { tab } = await searchParams;

  const [appointment, medicines] = await Promise.all([
    getAppointmentForExamination(id, user.id),
    getMedicinesList(),
  ]);

  if (!appointment) {
    notFound();
  }

  return (
    <ExaminationForm
      appointment={appointment}
      availableMedicines={medicines}
      defaultTab={tab === "prescription" ? "prescription" : "soap"}
    />
  );
}
