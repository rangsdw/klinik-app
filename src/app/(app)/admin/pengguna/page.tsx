import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { requireRole } from "@/lib/rbac";
import { listUsers } from "@/features/users/queries";
import { userListParamsSchema } from "@/features/users/schemas";
import { UserFilters } from "@/features/users/components/user-filters";
import { UsersTable } from "@/features/users/components/users-table";
import { UserFormDialog } from "@/features/users/components/user-form-dialog";

export const metadata: Metadata = { title: "Akun internal" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const params = userListParamsSchema.parse(await searchParams);
  const { rows, total, page, pageCount } = await listUsers(params);

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.role) sp.set("role", params.role);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/admin/pengguna${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Akun internal"
        description="Tambah akun dokter dan staf, atur tipe staf, dan nonaktifkan akun yang tidak dipakai."
        actions={<UserFormDialog mode="create" />}
      />

      <UserFilters q={params.q ?? ""} role={params.role ?? ""} />

      {rows.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={params.q || params.role ? "Tidak ada akun yang cocok" : "Belum ada akun"}
          description={
            params.q || params.role
              ? "Coba kata kunci lain atau hapus filter."
              : "Tambahkan akun dokter atau staf pertama Anda."
          }
          action={
            params.q || params.role ? (
              <Button variant="outline" asChild>
                <Link href="/admin/pengguna">Hapus filter</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <UsersTable rows={rows} currentUserId={admin.id} />
          <nav
            aria-label="Halaman"
            className="text-ink-muted flex items-center justify-between gap-4 text-sm"
          >
            <p className="tabular">
              {total} akun, halaman {page} dari {pageCount}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft aria-hidden="true" />
                    Sebelumnya
                  </Link>
                </Button>
              ) : null}
              {page < pageCount ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(page + 1)}>
                    Berikutnya
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
