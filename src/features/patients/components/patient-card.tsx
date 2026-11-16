import { TriangleAlert } from "lucide-react";
import { UserAvatar } from "@/components/ui-kit/user-avatar";
import { ageLabel } from "@/lib/date";
import { GENDER_LABEL, RELATIONSHIP_LABEL } from "@/features/patients/schemas";
import type { PatientView } from "@/features/patients/queries";

/**
 * Kartu pasien: identitas berobat (No. RM paling menonjol, seperti kartu berobat).
 * Menandai alergi bila ada (dipakai juga fitur Red Flag modul dokter).
 */
export function PatientCard({ patient }: { patient: PatientView }) {
  const facts = [
    { label: "Umur", value: ageLabel(patient.birthDate) },
    { label: "Jenis kelamin", value: GENDER_LABEL[patient.gender] },
    { label: "Gol. darah", value: patient.bloodType ?? "Belum diisi" },
  ];
  return (
    <section
      aria-label={`Kartu pasien ${patient.name}`}
      className="border-primary-200 bg-surface shadow-card overflow-hidden rounded-2xl border"
    >
      <div className="bg-primary-700 text-surface flex items-center gap-4 px-5 py-4 sm:px-6">
        <UserAvatar name={patient.name} size="lg" className="bg-surface text-primary-800" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{patient.name}</h2>
          <p className="text-primary-100 text-sm">
            {patient.isSelf ? "Pemilik akun" : RELATIONSHIP_LABEL[patient.relationship]}
          </p>
        </div>
      </div>
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:px-6">
        <div>
          <p className="text-ink-muted text-sm">No. rekam medis</p>
          <p className="tabular text-ink-strong mt-0.5 text-2xl font-bold tracking-tight">
            {patient.medicalRecordNumber}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-ink-muted text-sm">{f.label}</dt>
              <dd className="text-ink-strong mt-0.5 font-semibold">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {patient.allergies ? (
        <p className="border-line bg-warning-soft text-warning-ink flex items-start gap-2 border-t px-5 py-3 text-sm sm:px-6">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">Alergi:</span> {patient.allergies}
          </span>
        </p>
      ) : null}
    </section>
  );
}
