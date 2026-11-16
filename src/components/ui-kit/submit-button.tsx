"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = Omit<React.ComponentProps<typeof Button>, "type"> & {
  /** Paksa status pending (mis. dari useTransition / React Hook Form). */
  pending?: boolean;
  pendingLabel?: string;
};

/**
 * Tombol submit dengan state pending. Membaca useFormStatus untuk <form action={...}>,
 * atau prop `pending` untuk form React Hook Form. Saat pending, tombol nonaktif (cegah klik ganda).
 */
export function SubmitButton({
  children,
  pending: pendingProp,
  pendingLabel = "Memproses...",
  disabled,
  ...props
}: SubmitButtonProps) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;

  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
