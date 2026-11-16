"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  /** Tombol pemicu. Kosongkan bila dialog dikontrol lewat open/onOpenChange. */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Aksi yang dijalankan; dialog menutup setelah selesai. */
  onConfirm: () => Promise<unknown> | unknown;
};

/** Konfirmasi untuk aksi berbahaya (hapus, nonaktifkan, reset). */
export function ConfirmDialog({
  trigger,
  open: openProp,
  onOpenChange,
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [openState, setOpenState] = useState(false);
  const [pending, startTransition] = useTransition();
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => {
    if (pending) return;
    setOpenState(o);
    onOpenChange?.(o);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            aria-busy={pending}
            onClick={() =>
              startTransition(async () => {
                await onConfirm();
                setOpenState(false);
                onOpenChange?.(false);
              })
            }
          >
            {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
