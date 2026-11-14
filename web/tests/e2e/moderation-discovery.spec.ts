import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../support/playwright-global-setup";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const stamp = Date.now();
const PASSWORD = "BrowserTest1!pw";
const member = { name: "Member Mala", email: `member.${stamp}@example.com` };
// A made-up model name so search results cannot collide with other specs' data.
const MODEL = `Zephyrion${stamp}`;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/vehicles");
}

async function freshPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.describe.serial("discovery, moderation and account UI", () => {
  let vehicleUrl = "";
  let vehicleId = "";
  let memberId = "";

  test("a member adds a vehicle with specifications and finds it through search and filters", async ({ browser }) => {
    const { context, page } = await freshPage(browser);
    await page.goto("/register");
    await page.getByPlaceholder("Name").fill(member.name);
    await page.getByPlaceholder("Email").fill(member.email);
    await page.getByPlaceholder("Password (min 8 chars)").fill(PASSWORD);
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForURL("**/login?registered=1");
    await signIn(page, member.email, PASSWORD);

    await page.goto("/vehicles/new");
    await page.getByPlaceholder("Unique Identifier (required)").fill(`SPEC-${stamp}`);
    await page.getByPlaceholder("Manufacturer").fill("Hillman");
    await page.getByPlaceholder("Model").fill(MODEL);
    await page.getByPlaceholder("Year").fill("1957");
    await page.getByPlaceholder("Vehicle description/history").fill("Imported through Colombo harbour.");
    await page.locator('input[name="attr_color"]').fill("Cream");
    await page.locator('select[name="attr_fuelType"]').selectOption("DIESEL");
    await page.locator('input[name="attr_engineCc"]').fill("1390");
    await page.getByRole("button", { name: "Save Vehicle" }).click();
    // "new" would also match a generic id pattern, so exclude it explicitly.
    await page.waitForURL(/\/vehicles\/(?!new$)[^/]+$/);
    vehicleUrl = page.url();
    vehicleId = vehicleUrl.split("/").pop()!;

    const specs = page.locator('dl[aria-label="Specifications"]');
    await expect(specs).toContainText("Cream");
    await expect(specs).toContainText("Diesel");
    await expect(specs).toContainText("1,390");
    memberId = (await page.getByRole("link", { name: member.name }).first().getAttribute("href"))!.split("/").pop()!;

    // Anonymous visitors use the search form and the structured filters.
    const visitor = await freshPage(browser);
    await visitor.page.goto("/vehicles");
    await visitor.page.getByLabel("Search the archive").fill("harbour");
    await visitor.page.getByRole("button", { name: "Search" }).click();
    await expect(visitor.page.getByRole("heading", { name: `Hillman ${MODEL}` })).toBeVisible();
    await expect(visitor.page).toHaveURL(/q=harbour/);

    await visitor.page.goto(`/vehicles?q=${MODEL}&fuelType=DIESEL&yearFrom=1950&yearTo=1960`);
    await expect(visitor.page.getByText("1 vehicle found")).toBeVisible();
    await visitor.page.goto(`/vehicles?q=${MODEL}&fuelType=PETROL`);
    await expect(visitor.page.getByText("0 vehicles found")).toBeVisible();
    await visitor.page.goto(`/vehicles?q=${MODEL}&yearFrom=1990`);
    await expect(visitor.page.getByText("0 vehicles found")).toBeVisible();
    await visitor.context.close();
    await context.close();
  });

  test("a member uploads an avatar and sees it on settings", async ({ browser }) => {
    const { context, page } = await freshPage(browser);
    await signIn(page, member.email, PASSWORD);
    await page.goto("/account");
    await expect(page.getByText("is not verified yet")).toBeVisible();

    await page.getByLabel("Upload avatar").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("Avatar updated.")).toBeVisible();
    const avatar = page.getByRole("img", { name: "Your avatar" });
    await expect(avatar).toBeVisible();
    expect(await avatar.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Avatar removed.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Your avatar" })).toHaveCount(0);
    await context.close();
  });

  test("an admin hides the vehicle, the public can no longer see it, then unhides it", async ({ browser }) => {
    const adminSession = await freshPage(browser);
    const admin = adminSession.page;
    await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.goto(vehicleUrl);

    const controls = admin.getByRole("region", { name: "Moderator actions" });
    await controls.getByRole("button", { name: "Hide from public" }).click();
    await controls.getByPlaceholder("Reason (recorded in the audit log)").fill("Disputed ownership claim");
    await controls.getByRole("button", { name: "Confirm hide" }).click();
    await expect(admin.getByText("This vehicle is hidden from the public by a moderator.")).toBeVisible();

    const visitor = await freshPage(browser);
    const response = await visitor.page.goto(vehicleUrl);
    expect(response?.status()).toBe(404);
    await expect(visitor.page.getByText("We could not find that page")).toBeVisible();
    await visitor.page.goto(`/vehicles?q=${MODEL}`);
    await expect(visitor.page.getByText("0 vehicles found")).toBeVisible();
    expect(await (await visitor.page.request.get("/sitemap.xml")).text()).not.toContain(vehicleId);

    await controls.getByRole("button", { name: "Unhide" }).click();
    await controls.getByPlaceholder("Reason (recorded in the audit log)").fill("Claim verified");
    await controls.getByRole("button", { name: "Confirm unhide" }).click();
    await expect(admin.getByText("This vehicle is hidden from the public by a moderator.")).toHaveCount(0);

    expect((await visitor.page.goto(vehicleUrl))?.status()).toBe(200);
    expect(await (await visitor.page.request.get("/sitemap.xml")).text()).toContain(vehicleId);
    await visitor.context.close();
    await adminSession.context.close();
  });

  test("an admin bans the member, who is locked out, and the audit log shows both actions", async ({ browser }) => {
    const memberSession = await freshPage(browser);
    await signIn(memberSession.page, member.email, PASSWORD);

    const adminSession = await freshPage(browser);
    const admin = adminSession.page;
    await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.goto(`/users/${memberId}`);
    await admin.getByRole("button", { name: "Ban user" }).click();
    await admin.getByPlaceholder("Reason (recorded in the audit log)").fill("Posting spam listings");
    await admin.getByRole("button", { name: "Confirm ban" }).click();
    await expect(admin.getByText("This account is suspended.")).toBeVisible();

    // The member's existing browser session stops working immediately.
    const status = await memberSession.page.evaluate(async () => {
      const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Still here" }) });
      return { status: res.status, body: await res.json() };
    });
    expect(status).toEqual({ status: 403, body: { error: "Account suspended" } });
    await memberSession.context.close();

    // And a fresh sign-in is refused.
    const retry = await freshPage(browser);
    await retry.page.goto("/login");
    await retry.page.getByPlaceholder("Email").fill(member.email);
    await retry.page.getByPlaceholder("Password").fill(PASSWORD);
    await retry.page.getByRole("button", { name: "Sign In" }).click();
    await expect(retry.page.getByText("Invalid email or password.")).toBeVisible();
    await retry.context.close();

    await admin.goto("/moderation/log");
    // Scope to log entries: the filter dropdown also contains these labels as <option>s.
    const entries = admin.locator("main ul > li");
    await expect(entries.filter({ hasText: "User banned" }).filter({ hasText: "Reason: Posting spam listings" })).toHaveCount(1);
    await expect(entries.filter({ hasText: "Content hidden" }).filter({ hasText: "Reason: Disputed ownership claim" })).toHaveCount(1);
    await expect(entries.filter({ hasText: "Content unhidden" }).filter({ hasText: "Reason: Claim verified" })).toHaveCount(1);

    await admin.goto(`/users/${memberId}`);
    await admin.getByRole("button", { name: "Lift ban" }).click();
    await admin.getByRole("button", { name: "Confirm unban" }).click();
    await expect(admin.getByText("This account is suspended.")).toHaveCount(0);
    await adminSession.context.close();
  });

  test("password recovery pages behave without leaking whether an account exists", async ({ browser }) => {
    const { context, page } = await freshPage(browser);
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await page.getByPlaceholder("Email").fill(`nobody.${stamp}@example.com`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists for that address")).toBeVisible();

    await page.goto("/reset-password");
    await expect(page.getByText("This link is missing its token.")).toBeVisible();

    await page.goto(`/reset-password?token=${"x".repeat(43)}`);
    await page.getByPlaceholder("New password (min 8 chars)").fill("a-new-password-1");
    await page.getByPlaceholder("Repeat new password").fill("a-new-password-1");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("invalid or has expired");

    await page.goto(`/verify-email?token=${"y".repeat(43)}`);
    await page.getByRole("button", { name: "Confirm email address" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("invalid or has expired");
    await context.close();
  });

  test("SEO endpoints, metadata, landing page and error pages", async ({ page, request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("/sitemap.xml");

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/vehicles/${vehicleId}`);

    await page.goto(vehicleUrl);
    await expect(page).toHaveTitle(`1957 Hillman ${MODEL} | Cars of Ceylon`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", `1957 Hillman ${MODEL}`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);

    const vehicleImage = await request.get(`/vehicles/${vehicleId}/opengraph-image`);
    expect(vehicleImage.status()).toBe(200);
    expect(vehicleImage.headers()["content-type"]).toContain("image/png");
    expect((await request.get("/opengraph-image")).headers()["content-type"]).toContain("image/png");

    const missing = await page.goto("/vehicles/does-not-exist");
    expect(missing?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Preserve the history/ })).toBeVisible();
    await expect(page.getByLabel("Archive statistics")).toContainText("Vehicles");
    await expect(page.getByRole("heading", { name: "Recently added" })).toBeVisible();
  });

  test("the cross-origin guard also covers the account and recovery endpoints", async ({ request }) => {
    for (const path of ["/api/auth/password/forgot", "/api/auth/password/reset", "/api/auth/verify/send", "/api/auth/verify/confirm", "/api/auth/register"]) {
      const blocked = await request.post(path, { headers: { origin: "https://evil.example" }, data: {} });
      expect(blocked.status(), path).toBe(403);
    }
  });
});
