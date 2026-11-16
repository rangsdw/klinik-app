import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Lupa password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-ink-strong text-[1.75rem] font-bold tracking-tight">Lupa password</h1>
        <p className="text-ink-muted">
          Masukkan email akun Anda. Kami kirim tautan untuk membuat password baru.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-ink-muted text-center text-sm">
        Ingat password Anda?{" "}
        <Link
          href="/masuk"
          className="text-primary-700 font-semibold underline-offset-4 hover:underline"
        >
          Kembali masuk
        </Link>
      </p>
    </div>
  );
}
