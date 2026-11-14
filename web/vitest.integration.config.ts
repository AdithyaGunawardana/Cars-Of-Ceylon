import path from "node:path";
import { defineConfig } from "vitest/config";
import { getAppTestEnv } from "./tests/support/test-env";

// Integration tests: route handlers run for real against Postgres + MinIO (only the session is stubbed).
// Requires `docker compose up -d db minio` (or equivalent services in CI).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/vitest-global-setup.ts"],
    setupFiles: ["tests/support/setup.ts"],
    env: getAppTestEnv(),
    // One shared database, so run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
