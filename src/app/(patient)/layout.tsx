import { Brand } from "@/components/layout/brand";
import { PatientBottomNav, PatientTopNav } from "@/components/layout/patient-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { clinicConfig } from "@/config/clinic";
import { requireRole } from "@/lib/rbac";

/** Layout portal pasien: topbar sederhana + bottom navigation di mobile. */
export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("PATIENT");
  return (
    <div className="min-h-dvh">
      <header className="border-line bg-surface sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4 sm:px-6">
          <Brand name={clinicConfig.name} href="/pasien" />
          <PatientTopNav />
          <div className="ml-auto">
            <UserMenu
              name={user.name}
              email={user.email}
              roleLabel="Pasien"
              profileHref="/pasien/profil"
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 sm:pt-8 md:pb-12">
        {children}
      </main>
      <PatientBottomNav />
    </div>
  );
}
