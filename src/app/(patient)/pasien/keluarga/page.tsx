import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import { UserAvatar } from "@/components/ui-kit/user-avatar";
import { requireRole } from "@/lib/rbac";
import { ageLabel } from "@/lib/date";
import { MAX_FAMILY_MEMBERS } from "@/config/clinic";
import { listPatientsForAccount } from "@/features/patients/queries";
import { RELATIONSHIP_LABEL } from "@/features/patients/schemas";
import { MemberFormDialog } from "@/features/patients/components/member-form-dialog";
import { OneTimeToast } from "@/features/patients/components/welcome-toast";

export const metadata: Metadata = { title: "Anggota keluarga" };

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ dihapus?: string }>;
}) {
  const user = await requireRole("PATIENT");
  const [patients, { dihapus }] = await Promise.all([
    listPatientsForAccount(user.id),
    searchParams,
  ]);
  const full = patients.length >= MAX_FAMILY_MEMBERS;

  return (
    <div className="space-y-6">
      {dihapus ? (
        <OneTimeToast message="Anggota keluarga dihapus." cleanHref="/pasien/keluarga" />
      ) : null}
      <PageHeader
        title="Anggota keluarga"
        description={`Satu akun bisa berobat untuk ${MAX_FAMILY_MEMBERS} orang. Saat ini ${patients.length} terdaftar.`}
        actions={<MemberFormDialog disabled={full} />}
      />
      {full ? (
        <p role="status" className="bg-warning-soft text-warning-ink rounded-xl px-4 py-3 text-sm">
          Batas {MAX_FAMILY_MEMBERS} anggota sudah tercapai. Hapus anggota yang tidak lagi berobat
          untuk menambah yang baru.
        </p>
      ) : null}

      <ul className="grid gap-3 md:grid-cols-2">
        {patients.map((p) => (
          <li key={p.id}>
            <Link
              href={`/pasien/keluarga/${p.id}`}
              className="group border-line bg-surface hover:border-primary-300 flex items-center gap-4 rounded-2xl border p-4 transition-colors sm:p-5"
            >
              <UserAvatar name={p.name} size="lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-strong truncate font-semibold">{p.name}</span>
                  {p.isSelf ? (
                    <StatusBadge variant="success">Anda</StatusBadge>
                  ) : (
                    <StatusBadge variant="info">{RELATIONSHIP_LABEL[p.relationship]}</StatusBadge>
                  )}
                </div>
                <p className="text-ink-muted text-sm">
                  <span className="tabular">{p.medicalRecordNumber}</span>
                  <br />
                  {ageLabel(p.birthDate)}
                </p>
              </div>
              <ChevronRight
                aria-hidden="true"
                className="text-ink-muted group-hover:text-primary-700 size-5 shrink-0"
              />
              <span className="sr-only">Lihat detail {p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
