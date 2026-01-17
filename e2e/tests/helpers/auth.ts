import { APIRequestContext, Page } from "@playwright/test";
import { API_URL, getCsrfHeaders } from "./api";

type AuthStatus = {
  enabled: boolean;
  authenticated: boolean;
};

const AUTH_USERNAME = process.env.AUTH_USERNAME || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin";

const authStatusCache = new WeakMap<APIRequestContext, AuthStatus>();

const fetchAuthStatus = async (request: APIRequestContext): Promise<AuthStatus> => {
  const cached = authStatusCache.get(request);
  // Only use cache if we're already authenticated
  if (cached?.authenticated) return cached;

  const response = await request.get(`${API_URL}/auth/status`);
  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to fetch auth status: ${response.status()} ${text}`);
  }

  const data = (await response.json()) as AuthStatus;
  authStatusCache.set(request, data);
  return data;
};

const setAuthStatus = (request: APIRequestContext, status: AuthStatus) => {
  authStatusCache.set(request, status);
};

export const ensureApiAuthenticated = async (request: APIRequestContext) => {
  const status = await fetchAuthStatus(request);
  if (!status.enabled || status.authenticated) {
    return;
  }

  const headers = await getCsrfHeaders(request);
  const response = await request.post(`${API_URL}/auth/login`, {
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    data: {
      username: AUTH_USERNAME,
      password: AUTH_PASSWORD,
    },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to authenticate test session: ${response.status()} ${text}`);
  }

  setAuthStatus(request, { enabled: true, authenticated: true });
};

export const ensurePageAuthenticated = async (page: Page) => {
  await ensureApiAuthenticated(page.request);
};
