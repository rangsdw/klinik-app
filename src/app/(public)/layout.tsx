import Link from "next/link";
import { PublicNav } from "@/components/layout/public-nav";
import { Brand } from "@/components/layout/brand";
import { clinicConfig } from "@/config/clinic";
import { auth } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const dashboardHref = session?.user?.role
    ? homeFor(session.user.role, session.user.staffType)
    : null;
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNav clinicName={clinicConfig.name} dashboardHref={dashboardHref} />
      <main className="flex-1">{children}</main>
      <footer className="border-line bg-surface border-t">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-8 px-4 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Brand name={clinicConfig.name} />
            <p className="text-ink-muted max-w-xs text-sm">{clinicConfig.tagline}</p>
          </div>
          <nav aria-label="Tautan bawah">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2 text-[0.9375rem]">
              <li>
                <Link href="/#layanan" className="text-ink-soft hover:text-primary-800">
                  Layanan
                </Link>
              </li>
              <li>
                <Link href="/masuk" className="text-ink-soft hover:text-primary-800">
                  Masuk
                </Link>
              </li>
              <li>
                <Link href="/#jadwal" className="text-ink-soft hover:text-primary-800">
                  Jadwal dokter
                </Link>
              </li>
              <li>
                <Link href="/daftar" className="text-ink-soft hover:text-primary-800">
                  Daftar pasien
                </Link>
              </li>
              <li>
                <Link href="/#kontak" className="text-ink-soft hover:text-primary-800">
                  Kontak
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-line border-t">
          <p className="text-ink-muted mx-auto max-w-[1360px] px-4 py-5 text-sm sm:px-8">
            &copy; {year} {clinicConfig.name}
          </p>
        </div>
      </footer>
    </div>
  );
}
