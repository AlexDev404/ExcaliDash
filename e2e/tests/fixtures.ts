import { test as base, expect } from "@playwright/test";

const AUTH_USERNAME = process.env.AUTH_USERNAME || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin";

export const test = base;

test.beforeEach(async ({ page }) => {
  // Navigate to root to check if we need to login
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  // If we see the login page, perform login
  const loginText = page.getByText("Sign in to access your drawings");
  if (await loginText.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByLabel("Username").fill(AUTH_USERNAME);
    await page.getByLabel("Password").fill(AUTH_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    // Wait for dashboard to load
    await page.getByPlaceholder("Search drawings...").waitFor({ state: "visible", timeout: 15000 });
  }
});

export { expect };
