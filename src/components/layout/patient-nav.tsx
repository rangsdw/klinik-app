"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { patientNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/pasien") return pathname === "/pasien" || pathname.startsWith("/pasien/keluarga");
  return pathname === href || pathname.startsWith(href + "/");
}

/** Navigasi horizontal portal pasien (desktop). */
export function PatientTopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu pasien" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {patientNavigation.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-lg px-3.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-50 text-primary-800"
                    : "text-ink-soft hover:bg-paper hover:text-ink-strong",
                )}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Bottom navigation portal pasien (mobile), terasa seperti aplikasi. */
export function PatientBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Menu pasien"
      className="border-line bg-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {patientNavigation.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-primary-700" : "text-ink-muted hover:text-ink-strong",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active && "bg-primary-50",
                  )}
                >
                  <item.icon
                    aria-hidden="true"
                    className="size-5"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </span>
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
