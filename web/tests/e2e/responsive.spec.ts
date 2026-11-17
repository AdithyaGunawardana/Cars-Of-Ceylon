import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../support/playwright-global-setup";

// Phone-width regressions: the nav once ran off the screen for signed-in users (Sign Out was unreachable) and a long
// unbroken vehicle name stretched the page sideways.
test.use({ viewport: { width: 390, height: 844 } });

async function go(page: Page, url: string) {
  await page.goto(url);
  // Wait for hydration: clicking before it makes forms submit natively and menus ignore taps.
  await page.waitForLoadState("networkidle");
}

// Scope to the header nav: pages also contain their own links with the same names (e.g. "Add Vehicle").
const navLink = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true });

async function expectNoHorizontalScroll(page: Page, label: string) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${label} must not scroll sideways`).toBeLessThanOrEqual(innerWidth + 1);
}

test("phone: signed-in pages fit the screen and the menu works", async ({ page }) => {
  const stamp = Date.now();
  const longName = `Unbroken${stamp}`.padEnd(60, "x"); // one 60-character word

  await go(page, "/login");
  await page.getByPlaceholder("Email").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/vehicles");
  await page.waitForLoadState("networkidle");

  // Sign Out stays reachable without sideways scrolling.
  await expect(page.getByRole("link", { name: "Sign Out" })).toBeInViewport();

  // Menu: opens, lists every link for an admin, closes on Escape, closes after navigating, stays closed on Back.
  await page.getByRole("button", { name: "Menu" }).click();
  for (const name of ["Vehicles", "Add Vehicle", "Profile", "Following", "Settings", "Moderation", "Audit log"]) {
    await expect(navLink(page, name)).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();

  await page.getByRole("button", { name: "Menu" }).click();
  await navLink(page, "Settings").click();
  await page.waitForURL("**/account");
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await page.goBack();
  await page.waitForURL("**/vehicles");
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();

  // A vehicle with a very long unbroken name must wrap instead of widening the page.
  await go(page, "/vehicles/new");
  await page.getByPlaceholder("Unique Identifier (required)").fill(`RESP-${stamp}`);
  await page.getByPlaceholder("Manufacturer").fill("Responsive");
  await page.getByPlaceholder("Model").fill(longName);
  await page.getByPlaceholder("Year").fill("1980");
  await page.getByRole("button", { name: "Save Vehicle" }).click();
  await page.waitForURL(/\/vehicles\/(?!new$)[^/]+$/);
  await page.waitForLoadState("networkidle");
  const vehicleUrl = new URL(page.url()).pathname;

  for (const url of ["/", "/vehicles", vehicleUrl, "/account", "/feed", "/moderation/reports", "/moderation/log", "/login", "/forgot-password"]) {
    await go(page, url);
    await expectNoHorizontalScroll(page, url);
  }
});

test("phone: the home page stat labels are not broken mid-word", async ({ page }) => {
  await go(page, "/");
  const labels = await page.locator('dl[aria-label="Archive statistics"] dt').allTextContents();
  expect(labels).toEqual(["Vehicles", "Timeline events", "Photos"]);
  // A label broken mid-word would be taller than two lines of text.
  for (const dt of await page.locator('dl[aria-label="Archive statistics"] dt').all()) {
    const height = await dt.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeLessThan(40);
  }
});
