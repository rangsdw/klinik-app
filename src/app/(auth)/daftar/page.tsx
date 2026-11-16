import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { clinicConfig } from "@/config/clinic";

export const metadata: Metadata = { title: "Daftar pasien" };

export default function RegisterPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-ink-strong text-[1.75rem] font-bold tracking-tight">
          Daftar sebagai pasien
        </h1>
        <p className="text-ink-muted">
          Satu akun untuk Anda dan keluarga di {clinicConfig.name}. Nomor rekam medis dibuat
          otomatis.
        </p>
      </div>

      <RegisterForm />

      <p className="text-ink-muted text-center text-sm">
        Sudah punya akun?{" "}
        <Link
          href="/masuk"
          className="text-primary-700 font-semibold underline-offset-4 hover:underline"
        >
          Masuk
        </Link>
      </p>
    </div>
  );
}
