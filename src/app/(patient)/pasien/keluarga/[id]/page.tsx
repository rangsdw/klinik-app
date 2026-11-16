import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, QrCode } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { formatDate } from "@/lib/date";
import { getOwnedPatient } from "@/features/patients/queries";
import { PatientCard } from "@/features/patients/components/patient-card";
import { MemberFormDialog } from "@/features/patients/components/member-form-dialog";
import { DeleteMemberButton } from "@/features/patients/components/delete-member-button";

export const metadata: Metadata = { title: "Detail anggota" };

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("PATIENT");
  const { id } = await params;
  // Kepemilikan divalidasi di server: pasien akun lain -> 404.
  const patient = await getOwnedPatient(user.id, id);
  if (!patient) notFound();

  const details = [
    { label: "NIK", value: patient.nik },
    { label: "Tanggal lahir", value: formatDate(patient.birthDate) },
    { label: "No. HP", value: patient.phone },
    { label: "Alamat", value: patient.address },
    { label: "Alergi", value: patient.allergies },
    { label: "Kondisi khusus", value: patient.specialConditions },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/pasien/keluarga"
        className="text-ink-soft hover:text-primary-700 inline-flex h-11 items-center gap-1 rounded-lg text-sm font-medium"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Anggota keluarga
      </Link>

      <PatientCard patient={patient} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-labelledby="data-pasien"
          className="border-line bg-surface rounded-2xl border p-5 sm:p-6"
        >
          <h2 id="data-pasien" className="text-ink-strong text-lg font-semibold">
            Data pasien
          </h2>
          <dl className="divide-line mt-4 divide-y">
            {details.map((d) => (
              <div key={d.label} className="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <dt className="text-ink-muted text-sm">{d.label}</dt>
                <dd className="text-ink">
                  {d.value || <span className="text-ink-muted">Belum diisi</span>}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <MemberFormDialog patient={patient} />
            {!patient.isSelf ? <DeleteMemberButton id={patient.id} name={patient.name} /> : null}
          </div>
        </section>

        <section
          aria-labelledby="qr-pasien"
          className="border-line-strong bg-surface flex flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center"
        >
          <span className="bg-primary-50 text-primary-700 grid size-14 place-items-center rounded-full">
            <QrCode aria-hidden="true" className="size-7" />
          </span>
          <h2 id="qr-pasien" className="text-ink-strong mt-4 font-semibold">
            QR Code pasien
          </h2>
          <p className="text-ink-muted mt-1 max-w-xs text-sm">
            QR untuk check-in di klinik akan tampil di sini. Nomor RM:{" "}
            <span className="tabular text-ink font-semibold">{patient.medicalRecordNumber}</span>
          </p>
        </section>
      </div>
    </div>
  );
}
