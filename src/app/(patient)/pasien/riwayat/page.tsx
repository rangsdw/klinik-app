import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { EmptyState } from "@/components/ui-kit/empty-state";

export const metadata: Metadata = { title: "Riwayat kunjungan" };

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Riwayat kunjungan" />
      <EmptyState
        icon={History}
        title="Segera hadir"
        description="Riwayat periksa, diagnosis, dan resep akan tampil di sini setelah Anda berobat."
        action={
          <Button variant="outline" asChild>
            <Link href="/pasien">Kembali ke beranda</Link>
          </Button>
        }
      />
    </div>
  );
}
