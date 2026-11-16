import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { isResetTokenValid } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Atur ulang password", robots: { index: false } };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await isResetTokenValid(token);

  if (!valid) {
    return (
      <EmptyState
        icon={LinkIcon}
        title="Tautan tidak berlaku"
        description="Tautan ini sudah kedaluwarsa atau sudah dipakai. Tautan reset hanya berlaku 60 menit dan sekali pakai."
        action={
          <Button asChild>
            <Link href="/lupa-password">Minta tautan baru</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-ink-strong text-[1.75rem] font-bold tracking-tight">
          Buat password baru
        </h1>
        <p className="text-ink-muted">Minimal 8 karakter, kombinasi huruf dan angka.</p>
      </div>
      <ResetPasswordForm token={token} />
    </div>
  );
}
