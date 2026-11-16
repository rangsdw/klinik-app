import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";

/** Tampilan 403: dipakai app/forbidden.tsx dan /akses-ditolak (rewrite dari middleware). */
export function ForbiddenView() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <EmptyState
        className="w-full max-w-md"
        icon={ShieldX}
        title="Akses ditolak"
        description="Akun Anda tidak memiliki izin untuk membuka halaman ini. Bila menurut Anda ini keliru, hubungi admin klinik."
        action={
          <Button asChild>
            <Link href="/">Kembali ke beranda</Link>
          </Button>
        }
      />
    </main>
  );
}
