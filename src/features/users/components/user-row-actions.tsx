"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, MoreHorizontal, Pencil, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import type { UserRow } from "@/features/users/queries";
import { resetPasswordByAdminAction, setUserActiveAction } from "@/features/users/actions";
import { UserFormDialog } from "@/features/users/components/user-form-dialog";
import { TemporaryPasswordDialog } from "@/features/users/components/temporary-password-dialog";

type Pending = "edit" | "reset" | "toggle" | null;

export function UserRowActions({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [dialog, setDialog] = useState<Pending>(null);
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);
  const internal = user.role !== "PATIENT";
  const close = (o: boolean) => !o && setDialog(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${user.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {internal ? (
            <DropdownMenuItem onSelect={() => setDialog("edit")}>
              <Pencil aria-hidden="true" />
              Ubah akun
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setDialog("reset")}>
            <KeyRound aria-hidden="true" />
            Reset password
          </DropdownMenuItem>
          {!isSelf ? (
            <DropdownMenuItem onSelect={() => setDialog("toggle")}>
              {user.isActive ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
              {user.isActive ? "Nonaktifkan" : "Aktifkan"}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {internal ? (
        <UserFormDialog
          mode="edit"
          user={user}
          isSelf={isSelf}
          open={dialog === "edit"}
          onOpenChange={close}
        />
      ) : null}

      <ConfirmDialog
        open={dialog === "reset"}
        onOpenChange={close}
        title={`Reset password ${user.name}?`}
        description="Password lama tidak berlaku lagi. Password sementara ditampilkan sekali; sampaikan langsung kepada pemilik akun."
        confirmLabel="Reset password"
        destructive={false}
        onConfirm={async () => {
          const r = await resetPasswordByAdminAction(user.id);
          if (r.ok && r.data) setTemp({ name: r.data.name, password: r.data.temporaryPassword });
          else toast.error(r.message ?? "Gagal mereset password.");
        }}
      />

      <ConfirmDialog
        open={dialog === "toggle"}
        onOpenChange={close}
        title={user.isActive ? `Nonaktifkan ${user.name}?` : `Aktifkan ${user.name}?`}
        description={
          user.isActive
            ? "Akun tidak bisa masuk dan sesi yang sedang berjalan langsung berakhir. Data tetap tersimpan."
            : "Akun bisa masuk kembali dengan password yang sama."
        }
        confirmLabel={user.isActive ? "Nonaktifkan" : "Aktifkan"}
        destructive={user.isActive}
        onConfirm={async () => {
          const r = await setUserActiveAction(user.id, !user.isActive);
          if (r.ok) toast.success(r.message);
          else toast.error(r.message ?? "Gagal mengubah status akun.");
        }}
      />

      <TemporaryPasswordDialog value={temp} onClose={() => setTemp(null)} />
    </>
  );
}
