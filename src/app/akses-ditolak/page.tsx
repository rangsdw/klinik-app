import { ForbiddenView } from "@/components/layout/forbidden-view";

export const metadata = { title: "Akses ditolak", robots: { index: false } };

export default function AccessDeniedPage() {
  return <ForbiddenView />;
}
