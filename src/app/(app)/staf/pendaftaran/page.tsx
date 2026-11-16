import type { Metadata } from "next";
import { UserPlus, UsersRound } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export const metadata: Metadata = { title: "Pendaftaran" };

export default function RegistrationPage() {
  return (
    <ModulePlaceholder
      title="Pendaftaran"
      description="Daftarkan pasien walk-in dan bantu check-in."
      stats={[
        {
          label: "Pasien walk-in hari ini",
          icon: UserPlus,
          hint: "Tersedia setelah modul check-in (Tahap 4).",
        },
        {
          label: "Antrean aktif",
          icon: UsersRound,
          hint: "Tersedia setelah modul antrean (Tahap 4).",
        },
      ]}
      moduleNote="Form pendaftaran walk-in dan check-in QR akan tersedia di halaman ini."
    />
  );
}
