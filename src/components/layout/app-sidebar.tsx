"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { navigationFor } from "@/config/navigation";
import type { RoleName, StaffTypeName } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Brand } from "@/components/layout/brand";

type Props = { role: RoleName; staffType: StaffTypeName | null; clinicName: string };

function isActive(pathname: string, href: string, all: string[]) {
  if (pathname === href) return true;
  // Item paling spesifik yang cocok dianggap aktif (mis. /staf/farmasi, bukan /staf).
  const matches = all.filter((h) => pathname.startsWith(h + "/"));
  const best = matches.sort((a, b) => b.length - a.length)[0];
  return best === href;
}

function NavList({
  role,
  staffType,
  collapsed,
  onNavigate,
}: Omit<Props, "clinicName"> & { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = navigationFor(role, staffType);
  const hrefs = items.map((i) => i.href);
  return (
    <nav aria-label="Menu utama">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href, hrefs);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.title : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-50 text-primary-800"
                    : "text-ink-soft hover:bg-paper hover:text-ink-strong",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon
                  aria-hidden="true"
                  className={cn("size-5 shrink-0", active ? "text-primary-700" : "text-ink-muted")}
                />
                <span className={cn(collapsed && "sr-only")}>{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const STORAGE_KEY = "klinik.sidebar.collapsed";

/** Sidebar desktop (bisa diciutkan). Menu dari config/navigation.ts sesuai role & staffType. */
export function AppSidebar({ role, staffType, clinicName }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* localStorage tidak tersedia */
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {
        /* abaikan */
      }
      return !c;
    });
  }

  return (
    <aside
      className={cn(
        "border-line bg-surface sticky top-0 hidden h-dvh shrink-0 flex-col border-r lg:flex",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "border-line flex h-16 items-center border-b px-4",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? null : <Brand name={clinicName} href="/" />}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          className={cn(!collapsed && "ml-auto")}
          aria-label={collapsed ? "Lebarkan menu" : "Ciutkan menu"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavList role={role} staffType={staffType} collapsed={collapsed} />
      </div>
    </aside>
  );
}

/** Drawer menu untuk mobile/tablet. */
export function MobileNav({ role, staffType, clinicName }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Buka menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-line h-16 justify-center border-b px-4">
          <SheetTitle asChild>
            <div>
              <Brand name={clinicName} href="/" />
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="p-3">
          <NavList role={role} staffType={staffType} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
