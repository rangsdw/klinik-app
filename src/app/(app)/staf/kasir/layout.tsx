import { requireStaffType } from "@/lib/rbac";

/** Hanya staf dengan staffType CASHIER. */
export default async function StaffCashierLayout({ children }: { children: React.ReactNode }) {
  await requireStaffType("CASHIER");
  return children;
}
