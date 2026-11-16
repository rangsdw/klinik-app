import type { Metadata } from "next";
import { Package, Pill } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Farmasi" };

/** Titik sambung modul farmasi (Axel). */
export default function PharmacyPage() {
  return (
    <ModulePlaceholder
      title="Farmasi"
      description="Siapkan dan serahkan obat sesuai e-resep."
      stats={[
        { label: "Resep menunggu", icon: Pill, hint: "Modul farmasi (Axel)." },
        { label: "Stok menipis", icon: Package, hint: "Modul inventaris (Axel)." },
      ]}
      moduleNote="Daftar resep, penyerahan obat, dan stok (batch/FEFO) akan tersedia di halaman ini."
    />
  );
}
