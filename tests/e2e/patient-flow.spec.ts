import { expect, test } from "@playwright/test";
import { db, login, logout, phoneFrom, uniqueSuffix } from "./helpers";

test.afterAll(async () => {
  await db.$disconnect();
});

async function addMember(
  page: import("@playwright/test").Page,
  name: string,
  relationship: string,
  birthDate: string,
) {
  await page.getByRole("button", { name: "Tambah anggota" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nama lengkap").fill(name);
  await dialog.getByLabel("Hubungan dengan Anda").selectOption({ label: relationship });
  await dialog.getByLabel("Tanggal lahir").fill(birthDate);
  await dialog.getByLabel("Jenis kelamin").selectOption({ label: "Perempuan" });
  await dialog.getByRole("button", { name: "Tambah anggota" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
}

test("daftar -> portal -> tambah 2 anggota -> ganti pasien aktif -> keluar -> masuk lagi", async ({
  page,
}) => {
  const s = uniqueSuffix();
  const email = `e2e${s}@contoh.test`;
  const password = "rahasia123";

  await page.goto("/daftar");
  await page.getByLabel("Nama lengkap").fill("rani e2e");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("No. HP").fill(phoneFrom(s));
  await page.getByLabel("Tanggal lahir").fill("1992-03-14");
  await page.getByLabel("Jenis kelamin").selectOption("FEMALE");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Ulangi password").fill(password);
  await page.getByLabel(/Saya setuju/).check();
  await page.getByRole("button", { name: "Daftar sekarang" }).click();

  await expect(page).toHaveURL(/\/pasien$/);
  await expect(page.getByRole("heading", { name: "Halo, Rani" })).toBeVisible();
  await expect(page.getByText(/RM-\d{4}-\d{6}/).first()).toBeVisible();

  await page.goto("/pasien/keluarga");
  await addMember(page, "Bima E2e", "Anak", "2017-06-01");
  await addMember(page, "Sari E2e", "Orang tua", "1960-11-20");
  await expect(page.getByText("Saat ini 3 terdaftar")).toBeVisible();

  await page.goto("/pasien");
  await page.getByRole("button", { name: /Pasien aktif: Rani E2e/ }).click();
  await page.getByRole("menuitem", { name: /Bima E2e/ }).click();
  await expect(page.getByRole("region", { name: "Kartu pasien Bima E2e" })).toBeVisible();

  await logout(page);
  await login(page, email, password);
  await expect(page).toHaveURL(/\/pasien$/);
  // Pilihan pasien aktif tersimpan di cookie dan tetap divalidasi server.
  await expect(page.getByRole("region", { name: /Kartu pasien/ })).toBeVisible();
});

test("akun A tidak bisa membuka pasien milik akun B", async ({ page }) => {
  const demo = await db.user.findUniqueOrThrow({
    where: { email: "pasien@klinik.test" },
    include: { patients: true },
  });
  const foreignId = demo.patients[0]!.id;

  const s = uniqueSuffix();
  const email = `e2eb${s}@contoh.test`;
  await page.goto("/daftar");
  await page.getByLabel("Nama lengkap").fill("akun lain");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("No. HP").fill(phoneFrom(s));
  await page.getByLabel("Tanggal lahir").fill("1990-01-01");
  await page.getByLabel("Jenis kelamin").selectOption("MALE");
  await page.getByLabel("Password", { exact: true }).fill("rahasia123");
  await page.getByLabel("Ulangi password").fill("rahasia123");
  await page.getByLabel(/Saya setuju/).check();
  await page.getByRole("button", { name: "Daftar sekarang" }).click();
  await expect(page).toHaveURL(/\/pasien$/);

  await page.goto(`/pasien/keluarga/${foreignId}`);
  // notFound() dalam boundary loading.tsx dikirim via streaming (status 200), jadi periksa kontennya.
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await expect(page.getByText(demo.patients[0]!.medicalRecordNumber)).toHaveCount(0);
});

test("batas 10 anggota per akun", async ({ page }) => {
  const owner = await db.user.findUniqueOrThrow({ where: { email: "pasien@klinik.test" } });
  // Isi akun demo sampai 10 pasien lewat database, lalu pastikan UI menolak tambahan.
  const current = await db.patient.count({ where: { accountUserId: owner.id, deletedAt: null } });
  const created: string[] = [];
  for (let i = current; i < 10; i++) {
    const p = await db.patient.create({
      data: {
        accountUserId: owner.id,
        medicalRecordNumber: `RM-E2E-${uniqueSuffix().slice(-8)}${i}`,
        qrToken: `e2e-${uniqueSuffix()}-${i}`,
        name: `Isi Batas ${i}`,
        birthDate: new Date("2000-01-01"),
        gender: "MALE",
        relationship: "OTHER",
      },
    });
    created.push(p.id);
  }
  try {
    await login(page, "pasien@klinik.test");
    await page.goto("/pasien/keluarga");
    await expect(
      page.getByText("Batas 10 anggota sudah tercapai.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Tambah anggota" })).toBeDisabled();
  } finally {
    await db.patient.deleteMany({ where: { id: { in: created } } });
  }
});
