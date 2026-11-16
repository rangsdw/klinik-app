import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/features/auth/schemas";

const valid = {
  name: "Siti Rahmawati",
  email: "siti@contoh.test",
  phone: "0812 3456 7890",
  nik: "",
  birthDate: "1995-05-10",
  gender: "FEMALE" as const,
  address: "",
  password: "rahasia123",
  confirmPassword: "rahasia123",
  consent: true as const,
};

function errorsOf(input: unknown) {
  const r = registerSchema.safeParse(input);
  return r.success ? {} : r.error.flatten().fieldErrors;
}

describe("registerSchema", () => {
  it("menerima data valid", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("menolak password tanpa angka dengan pesan Indonesia", () => {
    expect(
      errorsOf({ ...valid, password: "rahasiaaa", confirmPassword: "rahasiaaa" }).password,
    ).toContain("Password harus mengandung angka");
  });

  it("menolak konfirmasi password yang berbeda", () => {
    expect(errorsOf({ ...valid, confirmPassword: "lain12345" }).confirmPassword).toContain(
      "Konfirmasi password tidak sama",
    );
  });

  it("NIK opsional tetapi harus 16 digit bila diisi", () => {
    expect(errorsOf({ ...valid, nik: "123" }).nik).toContain("NIK harus 16 digit angka");
    expect(registerSchema.safeParse({ ...valid, nik: "3201012345678901" }).success).toBe(true);
  });

  it("wajib menyetujui penggunaan data", () => {
    expect(errorsOf({ ...valid, consent: false }).consent?.[0]).toMatch(/menyetujui/);
  });

  it("menolak tanggal lahir di masa depan", () => {
    expect(errorsOf({ ...valid, birthDate: "2999-01-01" }).birthDate).toContain(
      "Tanggal lahir tidak boleh di masa depan",
    );
  });

  it("menolak no. HP tidak valid", () => {
    expect(errorsOf({ ...valid, phone: "12345" }).phone?.[0]).toMatch(/No. HP tidak valid/);
  });
});

describe("loginSchema", () => {
  it("mengubah 'on' menjadi remember=true", () => {
    const r = loginSchema.parse({ identifier: "a@b.test", password: "x", remember: "on" });
    expect(r.remember).toBe(true);
  });

  it("identifier wajib", () => {
    const r = loginSchema.safeParse({ identifier: " ", password: "x" });
    expect(r.success).toBe(false);
  });
});
