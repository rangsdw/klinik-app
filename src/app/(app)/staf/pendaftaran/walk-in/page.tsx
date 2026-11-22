import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requireStaffType } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";

export const metadata: Metadata = { title: "Pendaftaran Walk-in" };

export default async function StaffWalkInPage() {
  await requireStaffType("REGISTRATION");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Antrean Walk-in"
        description="Pendaftaran pasien yang datang langsung tanpa janji temu."
      />
      <EmptyState
        icon={UserPlus}
        title="Modul walk-in disiapkan di langkah berikutnya"
        description="Halaman pendaftaran pasien walk-in akan diaktifkan pada Langkah 7."
        action={
          <Button asChild variant="outline">
            <Link href="/staf/pendaftaran/check-in">Kembali ke Check-in</Link>
          </Button>
        }
      />
    </div>
  );
}
