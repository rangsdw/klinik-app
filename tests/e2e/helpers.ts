import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient();
export const DEMO_PASSWORD = "password123";

export async function login(
  page: Page,
  identifier: string,
  password = DEMO_PASSWORD,
  opts: { expectSuccess?: boolean } = {},
) {
  await page.goto("/masuk");
  await page.getByLabel("Email atau No. HP").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  // Tunggu redirect selesai agar navigasi berikutnya tidak membatalkan login.
  if (opts.expectSuccess !== false) await page.waitForURL((u) => !u.pathname.startsWith("/masuk"));
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /Menu akun/ }).click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/masuk/);
}

export function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** No. HP unik 08xx dari suffix (12 digit). */
export function phoneFrom(suffix: string) {
  return `0857${suffix.slice(-8).padStart(8, "0")}`;
}
