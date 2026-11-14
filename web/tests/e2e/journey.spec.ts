import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../support/playwright-global-setup";

// 1x1 PNG, enough for the storage round trip and for <img> to report a natural size.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const stamp = Date.now();
const PASSWORD = "BrowserTest1!pw";
const owner = { name: "Owner Olu", email: `owner.${stamp}@example.com` };
const reporter = { name: "Reporter Rae", email: `reporter.${stamp}@example.com` };
const uniqueIdentifier = `E2E-${stamp}`;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/vehicles");
}

async function registerAndSignIn(page: Page, user: { name: string; email: string }) {
  await page.goto("/register");
  await page.getByPlaceholder("Name").fill(user.name);
  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder("Password (min 8 chars)").fill(PASSWORD);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("**/login?registered=1");
  await expect(page.getByText("Registration successful")).toBeVisible();
  await signIn(page, user.email, PASSWORD);
}

async function freshPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.describe.serial("browser journey", () => {
  let vehicleUrl = "";

  test("owner registers, signs in and creates a vehicle", async ({ browser }) => {
    const { context, page } = await freshPage(browser);
    await registerAndSignIn(page, owner);
    await expect(page.getByText(owner.name)).toBeVisible();

    await page.goto("/vehicles/new");
    await page.getByPlaceholder("Unique Identifier (required)").fill(uniqueIdentifier);
    await page.getByPlaceholder("License Plate").fill(`PL-${stamp}`);
    await page.getByPlaceholder("Manufacturer").fill("Austin");
    await page.getByPlaceholder("Model").fill("A40 Devon");
    await page.getByPlaceholder("Year").fill("1960");
    await page.getByPlaceholder("Vehicle description/history").fill("Garage-kept since 1987.");
    await page.getByRole("button", { name: "Save Vehicle" }).click();

    await page.waitForURL(/\/vehicles\/(?!new)[a-z0-9]+$/);
    vehicleUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: "Austin A40 Devon" })).toBeVisible();
    await expect(page.getByText("Vehicle entry created")).toBeVisible();

    // Duplicate identifier is reported back to the user instead of crashing.
    await page.goto("/vehicles/new");
    await page.getByPlaceholder("Unique Identifier (required)").fill(uniqueIdentifier);
    await page.getByPlaceholder("Manufacturer").fill("Ford");
    await page.getByPlaceholder("Model").fill("Anglia");
    await page.getByPlaceholder("Year").fill("1962");
    await page.getByRole("button", { name: "Save Vehicle" }).click();
    await expect(page).toHaveURL(/error=duplicate/);

    await context.close();
  });

  test("owner manages the timeline: add, order, edit, delete", async ({ browser }) => {
    const { context, page } = await freshPage(browser);
    await signIn(page, owner.email, PASSWORD);
    await page.goto(vehicleUrl);

    const addEvent = async (title: string, occurredAt?: string) => {
      await page.getByPlaceholder("Event title").fill(title);
      await page.getByPlaceholder("What happened?").fill(`${title} details`);
      if (occurredAt) await page.locator('form input[name="occurredAt"]').first().fill(occurredAt);
      await page.getByRole("button", { name: "Save event" }).click();
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    };

    await addEvent("Engine rebuild");
    await addEvent("Old service", "1975-05-05T10:00");
    await addEvent("Recent inspection", "2024-02-02T10:00");

    // Newest real-world date first, undated entries last.
    const titles = await page.locator("ol > li p.font-semibold").allTextContents();
    expect(titles.indexOf("Recent inspection")).toBeLessThan(titles.indexOf("Old service"));
    expect(titles.indexOf("Old service")).toBeLessThan(titles.indexOf("Engine rebuild"));

    const row = (title: string) => page.getByRole("listitem").filter({ hasText: title }).first();

    await row("Engine rebuild").getByRole("button", { name: "Edit" }).click();
    await row("Engine rebuild").getByLabel("Title").fill("Engine rebuilt");
    await row("Engine rebuild").getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Engine rebuilt", { exact: true })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await row("Old service").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Old service", { exact: true })).toHaveCount(0);

    await context.close();
  });

  test("owner uploads a photo, edits its caption, views it in the lightbox and deletes it", async ({ browser }) => {
    const { context, page } = await freshPage(browser);
    await signIn(page, owner.email, PASSWORD);
    await page.goto(vehicleUrl);

    // Client-side validation fires before any network call.
    await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
    await page.getByRole("button", { name: "Upload photo" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Only JPEG, PNG or WebP" })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({ name: "front.png", mimeType: "image/png", buffer: PNG });
    await page.getByPlaceholder("Caption").fill("Front quarter");
    await page.getByRole("button", { name: "Upload photo" }).click();
    await expect(page.getByText("Photo added.")).toBeVisible();

    // The thumbnail is really served by storage and decodes.
    const thumb = page.getByRole("img", { name: "Front quarter" });
    await expect(thumb).toBeVisible();
    await expect.poll(() => thumb.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Caption", exact: true }).click();
    await page.getByLabel("Caption", { exact: true }).fill("Front three-quarter");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("img", { name: "Front three-quarter" })).toBeVisible();

    await page.getByRole("button", { name: /Open photo: Front three-quarter/ }).click();
    const viewer = page.getByRole("dialog", { name: "Photo viewer" });
    await expect(viewer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("listitem").filter({ has: page.getByRole("img") }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("No photos uploaded yet.")).toBeVisible();

    await context.close();
  });

  test("another user sees a read-only vehicle and files a report; an admin moderates it", async ({ browser }) => {
    const reporterSession = await freshPage(browser);
    await registerAndSignIn(reporterSession.page, reporter);
    await reporterSession.page.goto(vehicleUrl);
    await expect(reporterSession.page.getByText("Only the owner or moderators can add events.")).toBeVisible();
    await expect(reporterSession.page.getByRole("button", { name: "Edit" })).toHaveCount(0);

    await reporterSession.page.getByPlaceholder("Explain the issue (minimum 5 characters)").fill("The ownership dates look wrong.");
    await reporterSession.page.getByRole("button", { name: "Submit Report" }).click();
    await expect(reporterSession.page.getByText("Report submitted. A moderator will review it.")).toBeVisible();

    // Regular users cannot open the moderation queue.
    await reporterSession.page.goto("/moderation/reports");
    await expect(reporterSession.page.getByText("You do not have permission to access this page.")).toBeVisible();
    await reporterSession.context.close();

    const adminSession = await freshPage(browser);
    const admin = adminSession.page;
    await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.goto("/moderation/reports");

    const card = admin.locator("article").filter({ hasText: "The ownership dates look wrong." });
    await expect(card).toBeVisible();

    // Workflow buttons mirror the server rules: only "Mark Reviewing" is available for a pending report.
    await expect(card.getByRole("button", { name: "Resolve" })).toBeDisabled();
    await card.getByRole("button", { name: "Mark Reviewing" }).click();
    await expect(card.getByText("REVIEWING")).toBeVisible();
    await expect(card.getByRole("button", { name: "Resolve" })).toBeEnabled();

    await card.getByRole("button", { name: "Resolve" }).click();
    await expect(card.getByText("RESOLVED")).toBeVisible();
    await expect(card.getByRole("button", { name: "Resolve" })).toBeDisabled();
    await expect(card.getByText(/Last moderated by E2E Admin/)).toBeVisible();

    await adminSession.context.close();
  });

  test("public archive paginates and filters", async ({ page }) => {
    await page.goto("/vehicles?search=" + uniqueIdentifier);
    await expect(page.getByText("1 vehicle found")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Austin A40 Devon" })).toBeVisible();

    await page.goto("/vehicles?year=abc");
    await expect(page.getByText("Some filters were invalid and were ignored.")).toBeVisible();
  });
});
