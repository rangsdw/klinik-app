import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  ClipboardPlus,
  History,
  ListOrdered,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { firstName } from "@/lib/date";
import { getActivePatient, listPatientsForAccount } from "@/features/patients/queries";
import { PatientSwitcher } from "@/features/patients/components/patient-switcher";
import { PatientCard } from "@/features/patients/components/patient-card";
import { OneTimeToast } from "@/features/patients/components/welcome-toast";

export const metadata: Metadata = { title: "Beranda pasien" };

type Shortcut = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  primary?: boolean;
};

export default async function PatientHomePage({
  searchParams,
}: {
  searchParams: Promise<{ selamat?: string }>;
}) {
  const user = await requireRole("PATIENT");
  const [patients, active, { selamat }] = await Promise.all([
    listPatientsForAccount(user.id),
    getActivePatient(user.id),
    searchParams,
  ]);

  const shortcuts: Shortcut[] = [
    {
      href: "/pasien/janji",
      title: "Buat janji",
      description: "Pilih dokter dan jadwal periksa.",
      icon: ClipboardPlus,
      primary: true,
    },
    {
      href: "/pasien/antrean",
      title: "Antrean saya",
      description: "Lihat nomor dan posisi antrean.",
      icon: ListOrdered,
    },
    {
      href: "/pasien/riwayat",
      title: "Riwayat kunjungan",
      description: "Hasil periksa dan resep sebelumnya.",
      icon: History,
    },
    {
      href: "/pasien/keluarga",
      title: "Anggota keluarga",
      description: `${patients.length} pasien di akun ini.`,
      icon: UsersRound,
    },
  ];

  return (
    <div className="space-y-8">
      {selamat ? (
        <OneTimeToast message={`Selamat datang, ${firstName(user.name)}`} cleanHref="/pasien" />
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-ink-strong text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          Halo, {firstName(user.name)}
        </h1>
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

      {active ? <PatientCard patient={active} /> : null}

      <section aria-labelledby="pintasan">
        <h2 id="pintasan" className="sr-only">
          Pintasan
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {shortcuts.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className={
                  s.primary
                    ? "group bg-primary-700 text-surface hover:bg-primary-800 flex min-h-24 items-center gap-4 rounded-2xl p-5 transition-colors"
                    : "group border-line bg-surface hover:border-primary-300 hover:bg-primary-50/40 flex min-h-24 items-center gap-4 rounded-2xl border p-5 transition-colors"
                }
              >
                <span
                  className={
                    s.primary
                      ? "bg-primary-800 text-surface grid size-12 shrink-0 place-items-center rounded-xl"
                      : "bg-primary-50 text-primary-700 grid size-12 shrink-0 place-items-center rounded-xl"
                  }
                >
                  <s.icon aria-hidden="true" className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      s.primary
                        ? "block text-base font-semibold"
                        : "text-ink-strong block text-base font-semibold"
                    }
                  >
                    {s.title}
                  </span>
                  <span
                    className={
                      s.primary ? "text-primary-100 block text-sm" : "text-ink-muted block text-sm"
                    }
                  >
                    {s.description}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className={
                    s.primary
                      ? "text-primary-100 size-5"
                      : "text-ink-muted group-hover:text-primary-700 size-5"
                  }
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
