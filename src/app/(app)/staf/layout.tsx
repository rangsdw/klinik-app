import { requireRole } from "@/lib/rbac";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireRole("STAFF");
  return children;
}
