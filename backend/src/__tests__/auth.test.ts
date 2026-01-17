import { describe, it, expect, vi } from "vitest";
import {
  buildAuthConfig,
  createAuthSessionToken,
  getAuthSessionFromCookie,
  validateAuthSessionToken,
  verifyCredentials,
} from "../auth";

describe("Auth utilities", () => {
  it("disables auth when credentials are missing", () => {
    const config = buildAuthConfig({});
    expect(config.enabled).toBe(false);
  });

  it("verifies credentials and validates issued session tokens", () => {
    const config = buildAuthConfig({
      AUTH_USERNAME: "admin",
      AUTH_PASSWORD: "super-secret",
      AUTH_SESSION_SECRET: "test-secret",
    });

    expect(verifyCredentials(config, "admin", "super-secret")).toBe(true);
    expect(verifyCredentials(config, "admin", "wrong")).toBe(false);

    const token = createAuthSessionToken(config, "admin");
    const session = validateAuthSessionToken(config, token);
    expect(session).not.toBeNull();
    expect(session?.username).toBe("admin");
  });

  it("rejects expired session tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));

    const config = buildAuthConfig({
      AUTH_USERNAME: "admin",
      AUTH_PASSWORD: "secret",
      AUTH_SESSION_SECRET: "test-secret",
      AUTH_SESSION_TTL_HOURS: "0.001", // ~3.6 seconds
    });

    const token = createAuthSessionToken(config, "admin");
    vi.setSystemTime(new Date("2025-01-01T00:00:10.000Z"));

    expect(validateAuthSessionToken(config, token)).toBeNull();
    vi.useRealTimers();
  });

  it("extracts session tokens from cookies", () => {
    const config = buildAuthConfig({
      AUTH_USERNAME: "admin",
      AUTH_PASSWORD: "secret",
      AUTH_SESSION_SECRET: "test-secret",
    });

    const token = createAuthSessionToken(config, "admin");
    const cookieHeader = `${config.cookieName}=${encodeURIComponent(token)}; theme=dark`;
    const session = getAuthSessionFromCookie(cookieHeader, config);
    expect(session?.username).toBe("admin");
  });
});
