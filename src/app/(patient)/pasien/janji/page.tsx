import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { EmptyState } from "@/components/ui-kit/empty-state";

export const metadata: Metadata = { title: "Buat janji" };

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Buat janji" />
      <EmptyState
        icon={ClipboardPlus}
        title="Segera hadir"
        description="Pemesanan janji dokter sedang disiapkan. Nanti Anda bisa memilih dokter, tanggal, dan jam periksa di sini."
        action={
          <Button variant="outline" asChild>
            <Link href="/pasien">Kembali ke beranda</Link>
          </Button>
        }
      />
    </div>
  );
}
