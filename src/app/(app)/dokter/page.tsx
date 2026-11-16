import type { Metadata } from "next";
import { CalendarClock, ClipboardList, UsersRound } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requireRole } from "@/lib/rbac";

export const metadata: Metadata = { title: "Dashboard dokter" };

export default async function DoctorDashboardPage() {
  const user = await requireRole("DOCTOR");
  return (
    <ModulePlaceholder
      title={`Selamat bertugas, ${user.name}`}
      description="Jadwal hari ini, riwayat pasien, dan rekam medis Anda ada di sini."
      stats={[
        {
          label: "Janji hari ini",
          icon: CalendarClock,
          hint: "Tersedia setelah modul jadwal (Tahap 3).",
        },
        {
          label: "Menunggu diperiksa",
          icon: UsersRound,
          hint: "Tersedia setelah modul antrean (Tahap 4).",
        },
        { label: "Rekam medis hari ini", icon: ClipboardList, hint: "Modul rekam medis (Ravy)." },
      ]}
      moduleNote="Jadwal, rekam medis SOAP, dan e-resep akan tampil di halaman ini."
    />
  );
}
