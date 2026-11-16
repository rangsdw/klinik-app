import { describe, expect, it } from "vitest";
import { canAccessPath, hasRole, hasStaffType, homeFor, safeCallbackUrl } from "@/lib/roles";

describe("canAccessPath", () => {
  it("prefix route sesuai role", () => {
    expect(canAccessPath("/admin/pengguna", "ADMIN")).toBe(true);
    expect(canAccessPath("/admin", "PATIENT")).toBe(false);
    expect(canAccessPath("/staf", "DOCTOR")).toBe(false);
    expect(canAccessPath("/pasien/keluarga", "PATIENT")).toBe(true);
    expect(canAccessPath("/", "PATIENT")).toBe(true);
  });

  it("memisahkan akses antar sub-tipe staf", () => {
    expect(canAccessPath("/staf/farmasi", "STAFF", "PHARMACY")).toBe(true);
    expect(canAccessPath("/staf/kasir", "STAFF", "PHARMACY")).toBe(false);
    expect(canAccessPath("/staf/pendaftaran/baru", "STAFF", "CASHIER")).toBe(false);
    expect(canAccessPath("/staf", "STAFF", "CASHIER")).toBe(true);
  });

  it("tidak tertipu prefix mirip (/administrasi bukan /admin)", () => {
    expect(canAccessPath("/administrasi", "PATIENT")).toBe(true);
  });
});

describe("homeFor", () => {
  it("dashboard per role", () => {
    expect(homeFor("ADMIN")).toBe("/admin");
    expect(homeFor("DOCTOR")).toBe("/dokter");
    expect(homeFor("PATIENT")).toBe("/pasien");
    expect(homeFor("STAFF", "CASHIER")).toBe("/staf/kasir");
  });
});

describe("safeCallbackUrl", () => {
  it("hanya path internal", () => {
    expect(safeCallbackUrl("/pasien/keluarga")).toBe("/pasien/keluarga");
    expect(safeCallbackUrl("https://evil.test")).toBeNull();
    expect(safeCallbackUrl("//evil.test")).toBeNull();
    expect(safeCallbackUrl("/\\evil.test")).toBeNull();
    expect(safeCallbackUrl(undefined)).toBeNull();
  });
});

describe("hasRole / hasStaffType", () => {
  it("memeriksa role dan staffType", () => {
    expect(hasRole({ role: "ADMIN" }, "ADMIN", "DOCTOR")).toBe(true);
    expect(hasRole(null, "ADMIN")).toBe(false);
    expect(hasStaffType({ role: "STAFF", staffType: "PHARMACY" }, "PHARMACY")).toBe(true);
    expect(hasStaffType({ role: "STAFF", staffType: "PHARMACY" }, "CASHIER")).toBe(false);
    expect(hasStaffType({ role: "DOCTOR", staffType: null }, "PHARMACY")).toBe(false);
  });
});
