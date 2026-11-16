import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireRole } from "@/lib/rbac";
import { logoutAction } from "@/features/auth/actions";
import { ProfileForm } from "@/features/patients/components/profile-form";
import { ChangePasswordForm } from "@/features/patients/components/change-password-form";

export const metadata: Metadata = { title: "Profil akun" };

export default async function ProfilePage() {
  const user = await requireRole("PATIENT");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil akun"
        description="Data login akun Anda. Data medis tiap anggota diubah di menu keluarga."
      />

      <section
        aria-labelledby="data-akun"
        className="border-line bg-surface rounded-2xl border p-5 sm:p-6"
      >
        <h2 id="data-akun" className="text-ink-strong text-lg font-semibold">
          Data akun
        </h2>
        <ProfileForm defaults={{ name: user.name, email: user.email, phone: user.phone ?? "" }} />
      </section>

      <section
        aria-labelledby="ganti-password"
        className="border-line bg-surface rounded-2xl border p-5 sm:p-6"
      >
        <h2 id="ganti-password" className="text-ink-strong text-lg font-semibold">
          Ganti password
        </h2>
        <ChangePasswordForm />
      </section>

      <form action={logoutAction}>
        <Button type="submit" variant="outline" className="w-full sm:w-auto">
          <LogOut aria-hidden="true" />
          Keluar dari akun
        </Button>
      </form>
    </div>
  );
}
