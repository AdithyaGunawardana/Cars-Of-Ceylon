const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

/**
 * Assert expected status and throw a useful error with response body when it fails.
 */
async function assertStatus(response, expectedStatus, label) {
  if (response.status === expectedStatus) {
    return;
  }

  const bodyText = await response.text().catch(() => "<unreadable body>");
  throw new Error(`${label}: expected ${expectedStatus}, got ${response.status}. Body: ${bodyText}`);
}

/**
 * Parse JSON while preserving response text when payload is malformed.
 */
async function parseJson(response, label) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: expected JSON response. Body: ${text}`);
  }
}

async function main() {
  const checks = [];

  // Public listing should always be reachable without authentication.
  checks.push(async () => {
    const response = await fetch(`${baseUrl}/api/vehicles`);
    await assertStatus(response, 200, "GET /api/vehicles");
    const payload = await parseJson(response, "GET /api/vehicles");

    if (!Array.isArray(payload.items) || typeof payload.pagination !== "object" || payload.pagination === null) {
      throw new Error("GET /api/vehicles: missing expected items/pagination shape");
    }
  });

  // Query validation should reject impossible pagination values.
  checks.push(async () => {
    const response = await fetch(`${baseUrl}/api/vehicles?page=0`);
    await assertStatus(response, 400, "GET /api/vehicles?page=0");
  });

  // Mutating routes should deny unauthenticated callers.
  checks.push(async () => {
    const response = await fetch(`${baseUrl}/api/vehicles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uniqueIdentifier: "SMOKE-1",
        manufacturer: "Toyota",
        model: "Corolla",
        year: 2001,
      }),
    });
    await assertStatus(response, 401, "POST /api/vehicles (unauthenticated)");
  });

  checks.push(async () => {
    const response = await fetch(`${baseUrl}/api/vehicles/v-smoke/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "NOTE", title: "Smoke" }),
    });
    await assertStatus(response, 401, "POST /api/vehicles/:id/events (unauthenticated)");
  });

  checks.push(async () => {
    const response = await fetch(`${baseUrl}/api/vehicles/v-smoke/photos/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "smoke.png", fileType: "image/png", fileSize: 1 }),
    });
    await assertStatus(response, 401, "POST /api/vehicles/:id/photos/upload-url (unauthenticated)");
  });

  checks.push(async () => {
    const response = await fetch(`${baseUrl}/api/vehicles/v-smoke/photos/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageKey: "vehicles/v-smoke/smoke.png" }),
    });
    await assertStatus(response, 401, "POST /api/vehicles/:id/photos/finalize (unauthenticated)");
  });

  for (const [index, runCheck] of checks.entries()) {
    await runCheck();
    console.log(`check ${index + 1}/${checks.length} passed`);
  }

  console.log(`API smoke checks passed against ${baseUrl}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`API smoke check failed: ${message}`);
  process.exitCode = 1;
});
