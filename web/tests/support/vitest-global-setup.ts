import { ensureTestInfra } from "./test-env";

// Runs once before the integration suite: creates the test DB, applies migrations, creates the bucket.
export default async function setup() {
  await ensureTestInfra();
}
