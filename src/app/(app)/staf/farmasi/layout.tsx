import { requireStaffType } from "@/lib/rbac";

/** Hanya staf dengan staffType PHARMACY. */
export default async function StaffPharmacyLayout({ children }: { children: React.ReactNode }) {
  await requireStaffType("PHARMACY");
  return children;
}
