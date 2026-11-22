import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  CreditCard,
  House,
  LayoutDashboard,
  ListOrdered,
  Pill,
  ScanLine,
  UserRound,
  UserPlus,
  UserRoundPlus,
  Users,
  History,
  Stethoscope,
} from "lucide-react";
import type { RoleName, StaffTypeName } from "@/lib/roles";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Role yang melihat item ini. */
  roles: RoleName[];
  /** Bila diisi, hanya staf dengan staffType ini yang melihatnya. */
  staffTypes?: StaffTypeName[];
};

/**
 * SATU sumber menu sidebar area (app): admin, dokter, staf.
 * Modul lain (Ravy: rekam medis, Axel: farmasi/kasir) cukup menambah item di sini.
 */
export const appNavigation: NavItem[] = [
  // --- Admin (Rangga)
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard, roles: ["ADMIN"] },
  { title: "Akun internal", href: "/admin/pengguna", icon: Users, roles: ["ADMIN"] },

  // --- Dokter
  { title: "Dashboard & Janji", href: "/dokter", icon: LayoutDashboard, roles: ["DOCTOR"] },
  { title: "Pemeriksaan", href: "/dokter/periksa", icon: Stethoscope, roles: ["DOCTOR"] },
  { title: "Daftar Pasien", href: "/dokter/pasien", icon: Users, roles: ["DOCTOR"] },
  { title: "Stok Obat", href: "/dokter/obat", icon: Pill, roles: ["DOCTOR"] },

  // --- Staf
  { title: "Dashboard", href: "/staf", icon: LayoutDashboard, roles: ["STAFF"] },
  {
    title: "Pendaftaran",
    href: "/staf/pendaftaran",
    icon: UserPlus,
    roles: ["STAFF"],
    staffTypes: ["REGISTRATION"],
  },
  {
    title: "Check-in",
    href: "/staf/pendaftaran/check-in",
    icon: ScanLine,
    roles: ["STAFF"],
    staffTypes: ["REGISTRATION"],
  },
  {
    title: "Walk-in",
    href: "/staf/pendaftaran/walk-in",
    icon: UserRoundPlus,
    roles: ["STAFF"],
    staffTypes: ["REGISTRATION"],
  },
  {
    title: "Antrean Hari Ini",
    href: "/staf/pendaftaran/antrean",
    icon: ListOrdered,
    roles: ["STAFF"],
    staffTypes: ["REGISTRATION"],
  },
  {
    title: "Farmasi",
    href: "/staf/farmasi",
    icon: Pill,
    roles: ["STAFF"],
    staffTypes: ["PHARMACY"],
  },
  {
    title: "Kasir",
    href: "/staf/kasir",
    icon: CreditCard,
    roles: ["STAFF"],
    staffTypes: ["CASHIER"],
  },
];

export function navigationFor(role: RoleName, staffType?: StaffTypeName | null): NavItem[] {
  return appNavigation.filter(
    (item) =>
      item.roles.includes(role) &&
      (!item.staffTypes || (staffType != null && item.staffTypes.includes(staffType))),
  );
}

/** Navigasi portal pasien (bottom nav di mobile, horizontal di desktop). */
export const patientNavigation = [
  { title: "Beranda", href: "/pasien", icon: House },
  { title: "Janji", href: "/pasien/janji", icon: ClipboardList },
  { title: "Antrean", href: "/pasien/antrean", icon: ListOrdered },
  { title: "Riwayat", href: "/pasien/riwayat", icon: History },
  { title: "Profil", href: "/pasien/profil", icon: UserRound },
] as const;
