import { execSync } from "node:child_process";

/** Siapkan database test terpisah (klinik_app_test) dengan skema terbaru. */
export default function setup() {
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "mysql://root:@localhost:3306/klinik_app_test" },
  });
}
