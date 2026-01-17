import { test, expect } from "./fixtures";

test.describe("Authentication", () => {
  test("should require login and allow logout", async ({ page }) => {
    const username = process.env.AUTH_USERNAME || "admin";
    const password = process.env.AUTH_PASSWORD || "admin";

    await page.context().clearCookies();
    await page.goto("/");

    await expect(page.getByText("Sign in to access your drawings")).toBeVisible();

    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Wait for the dashboard to fully load (login updates state, no URL change)
    await expect(page.getByPlaceholder("Search drawings...")).toBeVisible({ timeout: 30000 });

    await page.goto("/settings");
    const logoutButton = page.getByRole("button", { name: /Log out/i });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    await expect(page.getByText("Sign in to access your drawings")).toBeVisible();
  });
});
