"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { SubmitButton } from "@/components/ui-kit/submit-button";

export function DesignInteractive() {
  return (
    <div className="flex flex-wrap gap-3">
      <ConfirmDialog
        trigger={<Button variant="destructive-outline">Buka ConfirmDialog</Button>}
        title="Hapus anggota keluarga?"
        description="Contoh dialog konfirmasi untuk aksi berbahaya."
        confirmLabel="Hapus"
        onConfirm={() =>
          new Promise((r) => setTimeout(r, 800)).then(() => toast.success("Contoh: data dihapus"))
        }
      />
      <Button variant="outline" onClick={() => toast.success("Data tersimpan.")}>
        Toast sukses
      </Button>
      <Button variant="outline" onClick={() => toast.error("Gagal menyimpan. Coba lagi.")}>
        Toast error
      </Button>
      <Button variant="outline" onClick={() => toast.info("Jadwal diperbarui.")}>
        Toast info
      </Button>
      <SubmitButton pending pendingLabel="Menyimpan...">
        Simpan
      </SubmitButton>
    </div>
  );
}
