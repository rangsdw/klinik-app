import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // "server-only" melempar error di luar React Server; kosongkan saat test.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globalSetup: ["./tests/support/global-setup.ts"],
    env: {
      DATABASE_URL: "mysql://root:@localhost:3306/klinik_app_test",
      AUTH_SECRET: "test-secret-test-secret-test-secret",
    },
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
