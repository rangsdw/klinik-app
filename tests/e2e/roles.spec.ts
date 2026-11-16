import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";
import { db, DEMO_PASSWORD, login, uniqueSuffix } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

const ROLE_HOMES = [
  { email: "admin@klinik.test", url: /\/admin$/, heading: "Dashboard admin" },
  { email: "dokter1@klinik.test", url: /\/dokter$/, heading: /Selamat bertugas/ },
  { email: "pendaftaran@klinik.test", url: /\/staf\/pendaftaran$/, heading: "Pendaftaran" },
  { email: "farmasi@klinik.test", url: /\/staf\/farmasi$/, heading: "Farmasi" },
  { email: "kasir@klinik.test", url: /\/staf\/kasir$/, heading: "Kasir" },
  { email: "pasien@klinik.test", url: /\/pasien$/, heading: /Halo, Budi/ },
];

for (const r of ROLE_HOMES) {
  test(`login ${r.email} menuju dashboard yang benar`, async ({ page }) => {
    await login(page, r.email);
    await expect(page).toHaveURL(r.url);
    await expect(page.getByRole("heading", { level: 1, name: r.heading })).toBeVisible();
  });
}

const CROSS = [
  { email: "pasien@klinik.test", path: "/admin" },
  { email: "dokter1@klinik.test", path: "/staf" },
  { email: "farmasi@klinik.test", path: "/staf/kasir" },
];

for (const c of CROSS) {
  test(`akses silang ditolak: ${c.email} ke ${c.path}`, async ({ page }) => {
    await login(page, c.email);
    const res = await page.goto(c.path);
    expect(res?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Akses ditolak" })).toBeVisible();
  });
}

test("belum login diarahkan ke /masuk dengan callbackUrl", async ({ page }) => {
  await page.goto("/admin/pengguna");
  await expect(page).toHaveURL(/\/masuk\?callbackUrl=%2Fadmin%2Fpengguna/);
});

test("akun nonaktif ditolak", async ({ page }) => {
  const s = uniqueSuffix();
  const email = `nonaktif${s}@klinik.test`;
  await db.user.create({
    data: {
      name: "Staf Nonaktif",
      email,
      role: "STAFF",
      staffType: "CASHIER",
      isActive: false,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
    },
  });
  try {
    await login(page, email, DEMO_PASSWORD, { expectSuccess: false });
    await expect(page.getByText(/Akun Anda sedang dinonaktifkan/)).toBeVisible();
    await expect(page).toHaveURL(/\/masuk/);
  } finally {
    await db.user.delete({ where: { email } });
  }
});

test("admin membuat akun staf dan menonaktifkannya", async ({ page }) => {
  const s = uniqueSuffix();
  const email = `stafbaru${s}@klinik.test`;
  await login(page, "admin@klinik.test");
  await page.goto("/admin/pengguna");
  await page.getByRole("button", { name: "Tambah akun" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nama lengkap").fill("staf baru e2e");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Role").selectOption("STAFF");
  await dialog.getByLabel("Tipe staf").selectOption("PHARMACY");
  await dialog.getByRole("button", { name: "Simpan akun" }).click();

  await expect(page.getByRole("heading", { name: "Password sementara" })).toBeVisible();
  await page.getByRole("button", { name: "Selesai" }).click();

  const row = await db.user.findUniqueOrThrow({ where: { email } });
  expect(row.staffType).toBe("PHARMACY");

  await page.goto(`/admin/pengguna?q=${encodeURIComponent(email)}`);
  await page.getByRole("button", { name: "Aksi untuk Staf Baru E2e" }).first().click();
  await page.getByRole("menuitem", { name: "Nonaktifkan" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Nonaktifkan" }).click();
  await expect
    .poll(async () => (await db.user.findUniqueOrThrow({ where: { email } })).isActive)
    .toBe(false);
  await db.user.delete({ where: { email } });
});
