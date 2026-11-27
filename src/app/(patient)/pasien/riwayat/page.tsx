import type { Metadata } from "next";
import Link from "next/link";
import type { PharmacyStatus } from "@prisma/client";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FlaskConical,
  History,
  PackageCheck,
  Pill,
  Stethoscope,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { formatDate } from "@/lib/date";
import {
  getActivePatient,
  listMedicalHistoryForPatient,
  listPatientsForAccount,
} from "@/features/patients/queries";
import { PatientSwitcher } from "@/features/patients/components/patient-switcher";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { StatCard } from "@/components/ui-kit/stat-card";
import { StatusBadge, type StatusVariant } from "@/components/ui-kit/status-badge";

export const metadata: Metadata = { title: "Riwayat kunjungan" };

const PHARMACY_BADGE: Record<
  PharmacyStatus,
  { label: string; variant: StatusVariant; icon: typeof Clock }
> = {
  WAITING: { label: "Menunggu apotek", variant: "warning", icon: Clock },
  PROCESSING: { label: "Sedang disiapkan", variant: "info", icon: FlaskConical },
  READY: { label: "Siap diambil di farmasi", variant: "info", icon: PackageCheck },
  DISPENSED: { label: "Obat diserahkan", variant: "success", icon: CheckCircle2 },
};

export default async function PatientMedicalHistoryPage() {
  const user = await requireRole("PATIENT");
  const [patients, active] = await Promise.all([
    listPatientsForAccount(user.id),
    getActivePatient(user.id),
  ]);

  const visits = active ? await listMedicalHistoryForPatient(user.id, active.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Riwayat Kunjungan"
          description="Catatan pemeriksaan dokter dan aturan minum obat dari kunjungan yang sudah selesai."
        />
        {active ? (
          <PatientSwitcher
            activeId={active.id}
            patients={patients.map((p) => ({
              id: p.id,
              name: p.name,
              relationship: p.relationship,
              isSelf: p.isSelf,
            }))}
          />
        ) : null}
      </div>

      {visits.length > 0 && active ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Kunjungan selesai"
            value={visits.length}
            icon={ClipboardCheck}
            hint={`${active.name} (${active.medicalRecordNumber})`}
          />
          <StatCard
            label="Kunjungan terakhir"
            value={formatDate(visits[0]!.appointmentDate)}
            icon={CalendarDays}
            hint={visits[0]!.doctorName}
          />
        </div>
      ) : null}

      {visits.length === 0 ? (
        <EmptyState
          icon={History}
          title="Belum ada riwayat kunjungan"
          description="Catatan hasil periksa dokter dan aturan minum obat akan tampil di sini setelah kunjungan Anda selesai diperiksa."
          action={
            <Button asChild className="bg-primary-700 text-surface hover:bg-primary-800">
              <Link href="/pasien/janji">Buat Janji Temu</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {visits.map((v) => {
            const hasVitals =
              Boolean(v.bloodPressure) ||
              v.bodyTemperature !== null ||
              v.bodyWeight !== null ||
              v.pulseRate !== null;

            const soapEntries = [
              { label: "Diagnosis / Penilaian", value: v.assessment },
              { label: "Keluhan", value: v.subjective ?? v.chiefComplaint },
              { label: "Pemeriksaan fisik", value: v.objective },
              { label: "Anjuran & rencana perawatan", value: v.plan },
            ].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));

            const pharmacyMeta = PHARMACY_BADGE[v.pharmacyStatus];
            const PharmacyIcon = pharmacyMeta.icon;

            return (
              <article
                key={v.id}
                className="border-line bg-surface shadow-card overflow-hidden rounded-2xl border"
              >
                <div className="border-line flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-ink-strong flex items-center gap-2 text-base font-bold">
                      <Stethoscope aria-hidden="true" className="text-primary-700 size-4 shrink-0" />
                      <span>{formatDate(v.appointmentDate)}</span>
                    </h2>
                    <p className="text-ink-soft text-sm">
                      {v.doctorName}, pukul {v.startTime} s.d. {v.endTime} WIB
                    </p>
                  </div>

                  <StatusBadge variant="success" icon={CheckCircle2}>
                    Selesai diperiksa
                  </StatusBadge>
                </div>

                {hasVitals ? (
                  <dl className="border-line bg-paper grid grid-cols-2 gap-4 border-b px-5 py-3.5 sm:grid-cols-4">
                    {v.bloodPressure ? (
                      <div>
                        <dt className="text-ink-muted text-xs">Tekanan darah</dt>
                        <dd className="tabular text-ink-strong mt-0.5 text-sm font-semibold">
                          {v.bloodPressure} mmHg
                        </dd>
                      </div>
                    ) : null}
                    {v.bodyTemperature !== null ? (
                      <div>
                        <dt className="text-ink-muted text-xs">Suhu tubuh</dt>
                        <dd className="tabular text-ink-strong mt-0.5 text-sm font-semibold">
                          {v.bodyTemperature} °C
                        </dd>
                      </div>
                    ) : null}
                    {v.bodyWeight !== null ? (
                      <div>
                        <dt className="text-ink-muted text-xs">Berat badan</dt>
                        <dd className="tabular text-ink-strong mt-0.5 text-sm font-semibold">
                          {v.bodyWeight} kg
                        </dd>
                      </div>
                    ) : null}
                    {v.pulseRate !== null ? (
                      <div>
                        <dt className="text-ink-muted text-xs">Denyut nadi</dt>
                        <dd className="tabular text-ink-strong mt-0.5 text-sm font-semibold">
                          {v.pulseRate} bpm
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                {soapEntries.length > 0 ? (
                  <dl className="divide-line divide-y px-5">
                    {soapEntries.map((entry) => (
                      <div
                        key={entry.label}
                        className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)]"
                      >
                        <dt className="text-ink-muted text-sm font-medium">{entry.label}</dt>
                        <dd className="text-ink whitespace-pre-line text-sm leading-relaxed">
                          {entry.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-ink-muted px-5 py-4 text-sm">
                    Catatan pemeriksaan ringkas belum ditambahkan.
                  </p>
                )}

                {v.prescriptions.length > 0 ? (
                  <div className="border-line border-t">
                    <div className="bg-paper border-line flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
                      <h3 className="text-ink-strong flex items-center gap-2 text-sm font-semibold">
                        <Pill aria-hidden="true" className="text-primary-700 size-4" />
                        <span>Resep &amp; Aturan Minum Obat ({v.prescriptions.length})</span>
                      </h3>
                      <StatusBadge variant={pharmacyMeta.variant} icon={PharmacyIcon}>
                        {pharmacyMeta.label}
                      </StatusBadge>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-line bg-surface text-ink-soft border-b text-xs font-medium">
                          <tr>
                            <th className="px-5 py-2.5 whitespace-nowrap">Nama obat</th>
                            <th className="px-4 py-2.5 whitespace-nowrap">Jumlah</th>
                            <th className="px-5 py-2.5 whitespace-nowrap">Aturan pakai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-line divide-y">
                          {v.prescriptions.map((rx) => (
                            <tr key={rx.id}>
                              <td className="text-ink-strong px-5 py-3 font-medium">
                                <p>{rx.medicineName}</p>
                                <p className="text-ink-muted text-xs">{rx.dosageForm}</p>
                              </td>
                              <td className="tabular text-ink px-4 py-3 whitespace-nowrap">
                                {rx.quantity} {rx.unit}
                              </td>
                              <td className="text-ink px-5 py-3">
                                <p className="font-medium">{rx.dosageInstructions}</p>
                                {rx.notes ? (
                                  <p className="text-ink-muted mt-0.5 text-xs">{rx.notes}</p>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
