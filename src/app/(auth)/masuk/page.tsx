import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Masuk" };

const STATUS: Record<string, { tone: "success" | "info"; text: string }> = {
  keluar: { tone: "info", text: "Anda sudah keluar. Sampai jumpa lagi." },
  reset: {
    tone: "success",
    text: "Password berhasil diatur ulang. Silakan masuk dengan password baru.",
  },
  nonaktif: {
    tone: "info",
    text: "Akun Anda sedang dinonaktifkan. Silakan hubungi petugas klinik.",
  },
  sesi: {
    tone: "info",
    text: "Sesi Anda sudah berakhir atau tidak lagi valid. Silakan masuk kembali.",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; status?: string }>;
}) {
  const { callbackUrl, status } = await searchParams;
  const notice = status ? STATUS[status] : undefined;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-ink-strong text-[1.75rem] font-bold tracking-tight">
          Masuk ke akun Anda
        </h1>
        <p className="text-ink-muted">Gunakan email atau no. HP yang Anda daftarkan.</p>
      </div>

      {notice ? (
        <Alert
          className={
            notice.tone === "success"
              ? "border-success/30 bg-success-soft"
              : "border-info/30 bg-info-soft"
          }
        >
          {notice.tone === "success" ? (
            <CircleCheck className="text-success-ink" />
          ) : (
            <Info className="text-info-ink" />
          )}
          <AlertDescription
            className={notice.tone === "success" ? "text-success-ink" : "text-info-ink"}
          >
            {notice.text}
          </AlertDescription>
        </Alert>
      ) : null}

      <LoginForm callbackUrl={callbackUrl ?? null} />

      <p className="text-ink-muted text-center text-sm">
        Belum punya akun?{" "}
        <Link
          href="/daftar"
          className="text-primary-700 font-semibold underline-offset-4 hover:underline"
        >
          Daftar sebagai pasien
        </Link>
      </p>
    </div>
  );
}
