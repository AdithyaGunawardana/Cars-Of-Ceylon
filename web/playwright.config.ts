import { defineConfig, devices } from "@playwright/test";
import { getAppTestEnv } from "./tests/support/test-env";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// Browser E2E against a production build, a dedicated Postgres DB and a dedicated MinIO bucket.
// Requires `docker compose up -d db minio` (or equivalent services in CI).
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/support/playwright-global-setup.ts",
  // One shared database: run serially.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `${BASE_URL}/api/vehicles`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { ...getAppTestEnv(), AUTH_URL: BASE_URL, NEXTAUTH_URL: BASE_URL },
  },
});
