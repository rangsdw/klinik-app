import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <EmptyState
        className="w-full max-w-md"
        icon={SearchX}
        title="Halaman tidak ditemukan"
        description="Alamat yang Anda buka tidak ada atau sudah dipindahkan."
        action={
          <Button asChild>
            <Link href="/">Kembali ke beranda</Link>
          </Button>
        }
      />
    </main>
  );
}
