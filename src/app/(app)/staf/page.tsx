import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireRole } from "@/lib/rbac";
import { STAFF_ROUTE, STAFF_TYPE_LABEL } from "@/lib/roles";

export const metadata: Metadata = { title: "Dashboard staf" };

export default async function StaffDashboardPage() {
  const user = await requireRole("STAFF");
  const type = user.staffType;
  return (
    <div className="space-y-8">
      <PageHeader
        title={`Halo, ${user.name}`}
        description={
          type
            ? `Anda bertugas di bagian ${STAFF_TYPE_LABEL[type].toLowerCase()}.`
            : "Tipe staf Anda belum diatur. Hubungi admin."
        }
      />
      {type ? (
        <Button asChild size="lg">
          <Link href={STAFF_ROUTE[type]}>
            Buka halaman {STAFF_TYPE_LABEL[type].toLowerCase()}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
