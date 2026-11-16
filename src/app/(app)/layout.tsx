import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { clinicConfig } from "@/config/clinic";
import { requireRole } from "@/lib/rbac";
import { ROLE_LABEL, STAFF_TYPE_LABEL } from "@/lib/roles";

/** Layout admin, dokter, staf: sidebar (desktop) + topbar; drawer di mobile. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN", "DOCTOR", "STAFF");
  const roleLabel =
    user.role === "STAFF" && user.staffType
      ? `Staf ${STAFF_TYPE_LABEL[user.staffType].toLowerCase()}`
      : ROLE_LABEL[user.role];

  return (
    <div className="flex min-h-dvh">
      <AppSidebar role={user.role} staffType={user.staffType} clinicName={clinicConfig.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-surface sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 sm:px-6">
          <MobileNav role={user.role} staffType={user.staffType} clinicName={clinicConfig.name} />
          <div className="ml-auto">
            <UserMenu name={user.name} email={user.email} roleLabel={roleLabel} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
