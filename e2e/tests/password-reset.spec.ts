import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const AUTH_USERNAME = process.env.AUTH_USERNAME || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin123";

const ensureLoggedOut = async (page: Page) => {
  await page.context().clearCookies();
  await page.goto("/");
  const signInPrompt = page.getByText("Sign in to access your drawings");
  if (await signInPrompt.isVisible().catch(() => false)) {
    return;
  }
  await page.goto("/settings");
  const logoutButton = page.getByRole("button", { name: /Log out/i });
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
  }
  await expect(signInPrompt).toBeVisible();
};

const login = async (page: Page, password: string) => {
  await page.getByLabel("Username or Email").fill(AUTH_USERNAME);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

const waitForResetOrDashboard = async (page: Page) => {
  const resetPrompt = page.getByText("Reset the admin password");
  const dashboardReady = page.getByPlaceholder("Search drawings...");
  const settingsHeader = page.getByRole("heading", { name: "Settings" });

  await Promise.race([
    resetPrompt.waitFor({ state: "visible", timeout: 15000 }).catch(() => null),
    dashboardReady.waitFor({ state: "visible", timeout: 15000 }).catch(() => null),
    settingsHeader.waitFor({ state: "visible", timeout: 15000 }).catch(() => null),
  ]);

  if (await resetPrompt.isVisible().catch(() => false)) {
    return "reset" as const;
  }

  if (await dashboardReady.isVisible().catch(() => false)) {
    return "dashboard" as const;
  }

  if (await settingsHeader.isVisible().catch(() => false)) {
    return "settings" as const;
  }

  return "unknown" as const;
};

const ensureDashboard = async (page: Page) => {
  await expect(page.getByPlaceholder("Search drawings...")).toBeVisible({ timeout: 30000 });
};

type CsrfInfo = {
  token: string;
  headerName: string;
};

const fetchCsrfInfo = async (page: Page): Promise<CsrfInfo> => {
  const response = await page.request.get(`${BASE_URL}/api/csrf-token`, {
    headers: { origin: BASE_URL },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(
      `Failed to fetch CSRF token: ${response.status()} ${text || "(empty response)"}`
    );
  }

  const data = (await response.json()) as { token: string; header?: string };
  if (!data || typeof data.token !== "string" || data.token.trim().length === 0) {
    throw new Error("Failed to fetch CSRF token: missing token in response");
  }

  const headerName =
    typeof data.header === "string" && data.header.trim().length > 0
      ? data.header
      : "x-csrf-token";

  return { token: data.token, headerName };
};

const setMustResetPassword = async (page: Page, enabled: boolean) => {
  const csrfInfo = await fetchCsrfInfo(page);
  let response = await page.request.post(`${BASE_URL}/api/auth/test/must-reset`, {
    headers: {
      origin: BASE_URL,
      "Content-Type": "application/json",
      [csrfInfo.headerName]: csrfInfo.token,
    },
    data: { enabled },
  });

  if (!response.ok() && response.status() === 403) {
    const refreshed = await fetchCsrfInfo(page);
    response = await page.request.post(`${BASE_URL}/api/auth/test/must-reset`, {
      headers: {
        origin: BASE_URL,
        "Content-Type": "application/json",
        [refreshed.headerName]: refreshed.token,
      },
      data: { enabled },
    });
  }

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to toggle mustResetPassword: ${response.status()} ${text}`);
  }
};

test.describe("Admin password reset", () => {
  test.use({ skipAuth: true });

  test("prompts and clears reset requirement for generated admin password", async ({ page }) => {
    await ensureLoggedOut(page);

    await login(page, AUTH_PASSWORD);
    let initialState = await waitForResetOrDashboard(page);
    if (initialState === "settings") {
      await page.goto("/");
      initialState = await waitForResetOrDashboard(page);
    }
    if (initialState === "reset") {
      await page.getByLabel("Current Password").fill(AUTH_PASSWORD);
      await page.getByLabel("New Password").fill(AUTH_PASSWORD);
      await page.getByLabel("Confirm Password").fill(AUTH_PASSWORD);
      await page.getByRole("button", { name: "Reset password" }).click();
      await expect(page.getByPlaceholder("Search drawings...")).toBeVisible({ timeout: 30000 });
    }

    await setMustResetPassword(page, true);
    await ensureLoggedOut(page);

    await login(page, AUTH_PASSWORD);
    await expect(page.getByText("Reset the admin password")).toBeVisible({ timeout: 30000 });
    await page.getByLabel("Current Password").fill(AUTH_PASSWORD);
    await page.getByLabel("New Password").fill(AUTH_PASSWORD);
    await page.getByLabel("Confirm Password").fill(AUTH_PASSWORD);
    await page.getByRole("button", { name: "Reset password" }).click();

    await page.goto("/");
    await ensureDashboard(page);

    await ensureLoggedOut(page);
    await login(page, AUTH_PASSWORD);
    await ensureDashboard(page);
  });
});
