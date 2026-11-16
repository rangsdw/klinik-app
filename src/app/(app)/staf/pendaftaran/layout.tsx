import { requireStaffType } from "@/lib/rbac";

/** Hanya staf dengan staffType REGISTRATION. */
export default async function StaffRegistrationLayout({ children }: { children: React.ReactNode }) {
  await requireStaffType("REGISTRATION");
  return children;
}
