import { test } from "@playwright/test";
import { login } from "./helpers";

/**
 * Screenshot halaman utama untuk bahan laporan: docs/screenshots/<halaman>-<mobile|desktop>.png
 * Jalankan: npx playwright test screenshots
 */
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
];

for (const vp of VIEWPORTS) {
  test(`screenshot ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    // Halaman portal di mobile diambil sebatas layar karena bottom nav bersifat fixed.
    const shot = (name: string, fullPage = true) =>
      page.screenshot({
        path: `docs/screenshots/${name}-${vp.name}.png`,
        fullPage,
        animations: "disabled",
      });
    const portalFull = vp.name !== "mobile";

    await page.goto("/");
    await shot("landing");
    await page.goto("/masuk");
    await shot("masuk");
    await page.goto("/daftar");
    await shot("daftar");

    await login(page, "pasien@klinik.test");
    await page.goto("/pasien");
    await page.getByRole("region", { name: /Kartu pasien/ }).waitFor();
    await shot("beranda-pasien", portalFull);
    await page.goto("/pasien/keluarga");
    await page.getByRole("heading", { name: "Anggota keluarga" }).waitFor();
    await shot("keluarga", portalFull);
  });
}
