import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseMedical, ShieldCheck, Stethoscope, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { StatCard } from "@/components/ui-kit/stat-card";
import { countUsersByRole } from "@/features/users/queries";

export const metadata: Metadata = { title: "Dashboard admin" };

export default async function AdminDashboardPage() {
  const counts = await countUsersByRole();
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard admin"
        description="Kelola akun dokter dan staf, serta data master klinik."
        actions={
          <Button asChild>
            <Link href="/admin/pengguna">Kelola akun internal</Link>
          </Button>
        }
      />
      <section aria-label="Akun aktif" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Admin aktif" value={counts.ADMIN} icon={ShieldCheck} />
        <StatCard label="Dokter aktif" value={counts.DOCTOR} icon={Stethoscope} />
        <StatCard label="Staf aktif" value={counts.STAFF} icon={BriefcaseMedical} />
        <StatCard label="Akun pasien" value={counts.PATIENT} icon={UsersRound} />
      </section>
    </div>
  );
}
