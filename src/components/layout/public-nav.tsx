import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/brand";

const LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/#layanan", label: "Layanan" },
  { href: "/#jadwal", label: "Jadwal Dokter" },
  { href: "/#kontak", label: "Kontak" },
];

/** Navbar publik: wordmark, empat tautan, dua aksi (atau "Ke Dashboard" bila sudah login). */
export function PublicNav({
  clinicName,
  dashboardHref,
}: {
  clinicName: string;
  dashboardHref: string | null;
}) {
  return (
    <header className="border-line/80 bg-paper sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-[72px] max-w-[1360px] items-center gap-8 px-4 sm:px-8">
        <Brand name={clinicName} />
        <nav aria-label="Navigasi utama" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-ink-soft hover:text-primary-800 inline-flex h-11 items-center rounded-lg px-3 text-[0.9375rem] font-medium whitespace-nowrap transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {dashboardHref ? (
            <Button asChild>
              <Link href={dashboardHref}>Ke Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/masuk">Masuk</Link>
              </Button>
              <Button asChild>
                <Link href="/daftar">Daftar</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
