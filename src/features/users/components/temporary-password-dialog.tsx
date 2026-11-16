"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Menampilkan password sementara SATU kali. Tidak disimpan di mana pun setelah ditutup. */
export function TemporaryPasswordDialog({
  value,
  onClose,
}: {
  value: { name: string; password: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      open={!!value}
      onOpenChange={(o) => {
        if (!o) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Password sementara</DialogTitle>
          <DialogDescription>
            Untuk {value?.name}. Password ini hanya ditampilkan sekali. Minta pemilik akun
            menggantinya setelah masuk.
          </DialogDescription>
        </DialogHeader>
        <div className="border-line bg-paper flex items-center gap-2 rounded-xl border p-3">
          <code className="text-ink-strong flex-1 text-lg font-semibold tracking-wide select-all">
            {value?.password}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!value) return;
              try {
                await navigator.clipboard.writeText(value.password);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Tersalin" : "Salin"}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
