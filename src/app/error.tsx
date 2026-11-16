"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <EmptyState
        className="w-full max-w-md"
        icon={TriangleAlert}
        title="Terjadi kesalahan"
        description="Maaf, halaman ini gagal dimuat. Coba muat ulang; bila masih gagal, hubungi petugas klinik."
        action={<Button onClick={reset}>Coba lagi</Button>}
      />
    </main>
  );
}
