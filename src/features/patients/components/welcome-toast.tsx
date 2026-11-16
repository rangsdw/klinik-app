"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Toast sekali pakai (mis. "Selamat datang, {nama}") lalu bersihkan query string. */
export function OneTimeToast({ message, cleanHref }: { message: string; cleanHref: string }) {
  const router = useRouter();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.success(message);
    router.replace(cleanHref, { scroll: false });
  }, [message, cleanHref, router]);
  return null;
}
