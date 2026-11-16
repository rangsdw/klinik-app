import type { Metadata } from "next";
import { CreditCard, Receipt } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Kasir" };

/** Titik sambung modul kasir & billing (Axel). */
export default function CashierPage() {
  return (
    <ModulePlaceholder
      title="Kasir"
      description="Buat tagihan, terima pembayaran, dan cetak kuitansi."
      stats={[
        { label: "Tagihan belum dibayar", icon: Receipt, hint: "Modul kasir (Axel)." },
        { label: "Pembayaran hari ini", icon: CreditCard, hint: "Modul kasir (Axel)." },
      ]}
      moduleNote="Tagihan, pembayaran, dan kuitansi akan tersedia di halaman ini."
    />
  );
}
