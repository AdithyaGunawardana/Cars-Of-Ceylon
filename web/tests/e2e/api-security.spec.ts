import { expect, test } from "@playwright/test";

// HTTP-level checks that need the real Next server (proxy, headers, NextAuth, rate limits).

test("security headers are present and the framework banner is hidden", async ({ request }) => {
  const response = await request.get("/vehicles");
  const headers = response.headers();

  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("cross-origin state-changing API calls are blocked, same-origin and origin-less ones reach auth", async ({ request, baseURL }) => {
  const blocked = await request.post("/api/reports", {
    headers: { origin: "https://evil.example" },
    data: { vehicleId: "x", reason: "csrf attempt" },
  });
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).error).toBe("Cross-origin request blocked");

  const sameOrigin = await request.post("/api/reports", {
    headers: { origin: baseURL! },
    data: { vehicleId: "x", reason: "legit but signed out" },
  });
  expect(sameOrigin.status()).toBe(401);

  const noOrigin = await request.post("/api/reports", { data: { vehicleId: "x", reason: "native client" } });
  expect(noOrigin.status()).toBe(401);
});

test("protected endpoints require authentication", async ({ request }) => {
  expect((await request.post("/api/vehicles", { data: {} })).status()).toBe(401);
  expect((await request.get("/api/reports")).status()).toBe(401);
  expect((await request.patch("/api/vehicles/anything/photos/anything", { data: { caption: "x" } })).status()).toBe(401);
  expect((await request.post("/api/users/anything/follow")).status()).toBe(401);
});

test("registration is throttled per client IP and does not leak password hashes", async ({ request }) => {
  const ip = `10.77.${Date.now() % 250}.9`;
  const statuses: number[] = [];

  for (let i = 0; i < 12; i += 1) {
    const response = await request.post("/api/auth/register", {
      headers: { "x-forwarded-for": ip },
      data: { name: "Throttle Test", email: `throttle.${Date.now()}.${i}@example.com`, password: "password123" },
    });
    statuses.push(response.status());
    if (response.status() === 201) {
      expect(JSON.stringify(await response.json())).not.toMatch(/passwordHash|\$2[aby]\$/);
    }
  }

  expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
  expect(statuses.slice(10)).toEqual([429, 429]);
});

test("credential login locks out after repeated failures even with the right password", async ({ request, baseURL }) => {
  const ip = `10.88.${Date.now() % 250}.9`;
  const email = `lockout.${Date.now()}@example.com`;
  const password = "CorrectHorse1!";

  const registered = await request.post("/api/auth/register", {
    headers: { "x-forwarded-for": ip },
    data: { name: "Lockout", email, password },
  });
  expect(registered.status()).toBe(201);

  async function attempt(pw: string) {
    const csrf = (await (await request.get("/api/auth/csrf", { headers: { "x-forwarded-for": ip } })).json()).csrfToken;
    await request.post("/api/auth/callback/credentials?json=true", {
      headers: { "x-forwarded-for": ip },
      form: { csrfToken: csrf, email, password: pw, callbackUrl: baseURL!, json: "true" },
    });
    const session = await (await request.get("/api/auth/session", { headers: { "x-forwarded-for": ip } })).json();
    return Boolean(session?.user?.id);
  }

  for (let i = 0; i < 10; i += 1) expect(await attempt(`wrong-password-${i}`)).toBe(false);
  expect(await attempt(password)).toBe(false);
});
