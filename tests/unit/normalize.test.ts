import { describe, expect, it } from "vitest";
import {
  isIndonesianPhone,
  normalizeEmail,
  normalizeName,
  normalizeNik,
  normalizePhone,
} from "@/lib/normalize";

describe("normalizePhone", () => {
  it.each([
    ["+62 812-3456-7890", "081234567890"],
    ["62812345678", "0812345678"],
    ["812 3456 7890", "081234567890"],
    ["0812.3456.7890", "081234567890"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("memvalidasi format HP Indonesia", () => {
    expect(isIndonesianPhone("081234567890")).toBe(true);
    expect(isIndonesianPhone("0212345678")).toBe(false);
    expect(isIndonesianPhone("0812")).toBe(false);
  });
});

describe("normalizeNik", () => {
  it("hanya menyisakan digit", () => {
    expect(normalizeNik("3201 0123-4567 8901")).toBe("3201012345678901");
  });
});

describe("normalizeName", () => {
  it("merapikan spasi dan Title Case", () => {
    expect(normalizeName("  budi   SANTOSO ")).toBe("Budi Santoso");
    expect(normalizeName("siti nur'aini")).toBe("Siti Nur'Aini");
    expect(normalizeName("ahmad al-farisi")).toBe("Ahmad Al-Farisi");
  });
});

describe("normalizeEmail", () => {
  it("trim + lowercase", () => {
    expect(normalizeEmail("  Budi@Klinik.TEST ")).toBe("budi@klinik.test");
  });
});
