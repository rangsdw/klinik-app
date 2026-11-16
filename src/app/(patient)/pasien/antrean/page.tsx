import type { Metadata } from "next";
import Link from "next/link";
import { ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { EmptyState } from "@/components/ui-kit/empty-state";

export const metadata: Metadata = { title: "Antrean saya" };

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Antrean saya" />
      <EmptyState
        icon={ListOrdered}
        title="Segera hadir"
        description="Nomor antrean dan posisi Anda akan tampil di sini setelah fitur antrean aktif."
        action={
          <Button variant="outline" asChild>
            <Link href="/pasien">Kembali ke beranda</Link>
          </Button>
        }
      />
    </div>
  );
}
