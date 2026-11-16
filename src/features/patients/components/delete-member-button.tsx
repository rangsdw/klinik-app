"use client";

import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { deletePatientAction } from "@/features/patients/actions";

export function DeleteMemberButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive-outline">
          <Trash2 aria-hidden="true" />
          Hapus
        </Button>
      }
      title={`Hapus ${name} dari akun?`}
      description="Anggota ini tidak lagi tampil di akun Anda dan tidak bisa dipilih untuk berobat. Data rekam medis tetap disimpan klinik."
      confirmLabel="Hapus anggota"
      onConfirm={async () => {
        const r = await deletePatientAction(id);
        if (r && !r.ok) toast.error(r.message ?? "Gagal menghapus anggota.");
      }}
    />
  );
}
