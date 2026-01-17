import crypto from "crypto";

export type AuthSameSite = "lax" | "strict" | "none";

export type AuthConfig = {
  enabled: boolean;
  username: string;
  password: string;
  sessionTtlMs: number;
  cookieName: string;
  cookieSameSite: AuthSameSite;
  secret: Buffer;
};

export type AuthSession = {
  username: string;
  iat: number;
  exp: number;
};

const DEFAULT_SESSION_TTL_HOURS = 24 * 7;
const DEFAULT_COOKIE_NAME = "excalidash_auth";
const DEFAULT_COOKIE_SAMESITE: AuthSameSite = "lax";

const base64UrlEncode = (input: Buffer | string): string => {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const base64UrlDecode = (input: string): Buffer => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
};

const parseSessionTtlHours = (rawValue?: string): number => {
  if (!rawValue) return DEFAULT_SESSION_TTL_HOURS;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SESSION_TTL_HOURS;
  }
  return parsed;
};

const parseSameSite = (rawValue?: string): AuthSameSite => {
  if (!rawValue) return DEFAULT_COOKIE_SAMESITE;
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "none" || normalized === "strict" || normalized === "lax") {
    return normalized;
  }
  return DEFAULT_COOKIE_SAMESITE;
};

const resolveAuthSecret = (enabled: boolean, env: NodeJS.ProcessEnv): Buffer => {
  if (!enabled) return Buffer.alloc(0);

  const secretFromEnv = env.AUTH_SESSION_SECRET;
  if (secretFromEnv && secretFromEnv.trim().length > 0) {
    return Buffer.from(secretFromEnv, "utf8");
  }

  const generated = crypto.randomBytes(32);
  const envLabel = env.NODE_ENV ? ` (${env.NODE_ENV})` : "";
  console.warn(
    `[security] AUTH_SESSION_SECRET is not set${envLabel}. ` +
      "Using an ephemeral per-process secret. Sessions will be invalidated on restart."
  );
  return generated;
};

export const buildAuthConfig = (env: NodeJS.ProcessEnv = process.env): AuthConfig => {
  const username = (env.AUTH_USERNAME || "").trim();
  const password = env.AUTH_PASSWORD || "";
  const enabled = username.length > 0 && password.length > 0;
  const sessionTtlHours = parseSessionTtlHours(env.AUTH_SESSION_TTL_HOURS);
  const cookieName = (env.AUTH_COOKIE_NAME || DEFAULT_COOKIE_NAME).trim();
  const cookieSameSite = parseSameSite(env.AUTH_COOKIE_SAMESITE);

  return {
    enabled,
    username,
    password,
    sessionTtlMs: sessionTtlHours * 60 * 60 * 1000,
    cookieName: cookieName.length > 0 ? cookieName : DEFAULT_COOKIE_NAME,
    cookieSameSite,
    secret: resolveAuthSecret(enabled, env),
  };
};

const signToken = (secret: Buffer, payloadB64: string): Buffer =>
  crypto.createHmac("sha256", secret).update(payloadB64, "utf8").digest();

const safeCompare = (left: string, right: string): boolean => {
  const leftHash = crypto.createHash("sha256").update(left, "utf8").digest();
  const rightHash = crypto.createHash("sha256").update(right, "utf8").digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
};

export const verifyCredentials = (
  config: AuthConfig,
  inputUsername: string,
  inputPassword: string
): boolean => {
  if (!config.enabled) return false;
  return safeCompare(config.username, inputUsername) && safeCompare(config.password, inputPassword);
};

export const createAuthSessionToken = (config: AuthConfig, username: string): string => {
  if (!config.enabled) {
    throw new Error("Authentication is not enabled.");
  }

  const issuedAt = Date.now();
  const payload: AuthSession = {
    username,
    iat: issuedAt,
    exp: issuedAt + config.sessionTtlMs,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(payloadJson);
  const sigB64 = base64UrlEncode(signToken(config.secret, payloadB64));

  return `${payloadB64}.${sigB64}`;
};

export const validateAuthSessionToken = (
  config: AuthConfig,
  token: string | undefined | null
): AuthSession | null => {
  if (!config.enabled || !token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, sigB64] = parts;
  try {
    const expectedSig = signToken(config.secret, payloadB64);
    const providedSig = base64UrlDecode(sigB64);
    if (providedSig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(providedSig, expectedSig)) return null;

    const payloadJson = base64UrlDecode(payloadB64).toString("utf8");
    const payload = JSON.parse(payloadJson) as Partial<AuthSession>;
    if (
      typeof payload.username !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload as AuthSession;
  } catch {
    return null;
  }
};

export const parseCookieHeader = (
  cookieHeader: string | undefined
): Record<string, string> => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    const value = rest.join("=");
    acc[decodeURIComponent(rawKey)] = decodeURIComponent(value || "");
    return acc;
  }, {});
};

export const getAuthSessionFromCookie = (
  cookieHeader: string | undefined,
  config: AuthConfig
): AuthSession | null => {
  if (!config.enabled) return null;
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[config.cookieName];
  return validateAuthSessionToken(config, token);
};

export const buildAuthCookieOptions = (
  secure: boolean,
  sameSite: AuthSameSite,
  maxAgeMs?: number
) => {
  const normalizedSameSite = sameSite === "none" ? "none" : sameSite;
  const options: {
    httpOnly: boolean;
    sameSite: AuthSameSite;
    secure: boolean;
    path: string;
    maxAge?: number;
  } = {
    httpOnly: true,
    sameSite: normalizedSameSite,
    secure: normalizedSameSite === "none" ? true : secure,
    path: "/",
  };
  if (typeof maxAgeMs === "number" && Number.isFinite(maxAgeMs) && maxAgeMs > 0) {
    options.maxAge = maxAgeMs;
  }
  return options;
};
