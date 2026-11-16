"use client";

import { DataTable, type Column } from "@/components/ui-kit/data-table";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import { UserAvatar } from "@/components/ui-kit/user-avatar";
import { ROLE_LABEL, STAFF_TYPE_LABEL } from "@/lib/roles";
import type { UserRow } from "@/features/users/queries";
import { UserRowActions } from "@/features/users/components/user-row-actions";

export function UsersTable({ rows, currentUserId }: { rows: UserRow[]; currentUserId: string }) {
  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "Nama",
      primary: true,
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={u.name} size="sm" />
          <div className="min-w-0">
            <p className="text-ink-strong truncate font-semibold">
              {u.name}
              {u.id === currentUserId ? (
                <span className="text-ink-muted ml-1.5 font-normal">(Anda)</span>
              ) : null}
            </p>
            <p className="text-ink-muted truncate text-sm font-normal">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (u) => (
        <span className="whitespace-nowrap">
          {ROLE_LABEL[u.role]}
          {u.staffType ? (
            <span className="text-ink-muted">, {STAFF_TYPE_LABEL[u.staffType].toLowerCase()}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "phone",
      header: "No. HP",
      cell: (u) => <span className="tabular">{u.phone ?? "-"}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (u) =>
        u.isActive ? (
          <StatusBadge variant="success">Aktif</StatusBadge>
        ) : (
          <StatusBadge variant="neutral">Nonaktif</StatusBadge>
        ),
    },
    {
      key: "actions",
      header: "Aksi",
      actions: true,
      cell: (u) => <UserRowActions user={u} isSelf={u.id === currentUserId} />,
    },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(u) => u.id} caption="Daftar akun" />;
}
