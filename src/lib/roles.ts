/**
 * Konstanta role yang aman dipakai di edge (middleware) maupun klien.
 * Jangan impor Prisma di sini.
 */
export const ROLES = ["ADMIN", "DOCTOR", "STAFF", "PATIENT"] as const;
export type RoleName = (typeof ROLES)[number];

export const STAFF_TYPES = ["REGISTRATION", "PHARMACY", "CASHIER"] as const;
export type StaffTypeName = (typeof STAFF_TYPES)[number];

export const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: "Admin",
  DOCTOR: "Dokter",
  STAFF: "Staf",
  PATIENT: "Pasien",
};

export const STAFF_TYPE_LABEL: Record<StaffTypeName, string> = {
  REGISTRATION: "Pendaftaran",
  PHARMACY: "Farmasi",
  CASHIER: "Kasir",
};

/** Dashboard tujuan setelah login. */
export const ROLE_HOME: Record<RoleName, string> = {
  ADMIN: "/admin",
  DOCTOR: "/dokter",
  STAFF: "/staf",
  PATIENT: "/pasien",
};

/** Prefix route yang dilindungi beserta role yang boleh mengaksesnya. */
export const ROUTE_ROLES: { prefix: string; roles: RoleName[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/dokter", roles: ["DOCTOR"] },
  { prefix: "/staf", roles: ["STAFF"] },
  { prefix: "/pasien", roles: ["PATIENT"] },
];

/** Sub-route staf per staffType. */
export const STAFF_ROUTE: Record<StaffTypeName, string> = {
  REGISTRATION: "/staf/pendaftaran",
  PHARMACY: "/staf/farmasi",
  CASHIER: "/staf/kasir",
};

export function homeFor(role: RoleName, staffType?: StaffTypeName | null): string {
  if (role === "STAFF" && staffType) return STAFF_ROUTE[staffType];
  return ROLE_HOME[role];
}

/** callbackUrl aman: hanya path internal ("/..." bukan "//..."). */
export function safeCallbackUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export function rolesForPath(pathname: string): RoleName[] | null {
  const match = ROUTE_ROLES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  return match ? match.roles : null;
}

/** Apakah user (role + staffType) boleh membuka path ini. */
export function canAccessPath(
  pathname: string,
  role: RoleName,
  staffType?: StaffTypeName | null,
): boolean {
  const roles = rolesForPath(pathname);
  if (!roles) return true;
  if (!roles.includes(role)) return false;
  if (role === "STAFF") {
    for (const [type, route] of Object.entries(STAFF_ROUTE)) {
      if ((pathname === route || pathname.startsWith(route + "/")) && type !== staffType) {
        return false;
      }
    }
  }
  return true;
}

/** Fungsi murni untuk test & pemakaian di luar React. */
export function hasRole(user: { role: RoleName } | null, ...roles: RoleName[]): boolean {
  return !!user && roles.includes(user.role);
}

export function hasStaffType(
  user: { role: RoleName; staffType: StaffTypeName | null } | null,
  ...types: StaffTypeName[]
): boolean {
  return !!user && user.role === "STAFF" && !!user.staffType && types.includes(user.staffType);
}
