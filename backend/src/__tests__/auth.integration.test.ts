import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { vi } from "vitest";
import {
  cleanupTestDb,
  getTestDatabaseUrl,
  getTestPrisma,
  initTestDb,
  setupTestDb,
} from "./testUtils";

let prisma = getTestPrisma();

describe("Authentication flows", () => {
  let app: any;

  beforeAll(async () => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    process.env.AUTH_SESSION_SECRET = "test-secret";
    process.env.NODE_ENV = "test";
    setupTestDb();
    prisma = getTestPrisma();
    await initTestDb(prisma);
    const appModule = (await import("../index")) as { default: unknown };
    app = appModule.default;
  });

  beforeEach(() => {
    delete process.env.LOGIN_RATE_LIMIT_MAX;
    delete process.env.LOGIN_MAX_FAILURES;
  });

  beforeEach(async () => {
    await cleanupTestDb(prisma);
    await initTestDb(prisma);
  });

  const fetchCsrfToken = async () => {
    const csrf = await request(app).get("/csrf-token");
    return csrf.body?.token as string;
  };

  const createAdminSession = async () => {
    let token = await fetchCsrfToken();
    const bootstrap = await request(app)
      .post("/auth/bootstrap")
      .set("x-csrf-token", token)
      .send({ username: "admin", password: "password123" });

    if (bootstrap.status !== 201) {
      throw new Error(`Bootstrap failed: ${bootstrap.status} ${JSON.stringify(bootstrap.body)}`);
    }

    token = await fetchCsrfToken();
    const login = await request(app)
      .post("/auth/login")
      .set("x-csrf-token", token)
      .send({ username: "admin", password: "password123" });

    const cookies = login.headers["set-cookie"];
    if (!cookies) return undefined;
    return Array.isArray(cookies) ? cookies : [cookies];
  };

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("requires bootstrap before registration", async () => {
    const token = await fetchCsrfToken();
    const response = await request(app)
      .post("/auth/register")
      .set("x-csrf-token", token)
      .send({ username: "user1", password: "password123" });
    expect(response.status).toBe(409);
  });

  it("bootstraps first admin and logs in", async () => {
    const cookie = await createAdminSession();
    expect(cookie).toBeTruthy();
  });

  it("toggles registration when admin", async () => {
    const cookie = await createAdminSession();
    expect(cookie).toBeTruthy();

    const token = await fetchCsrfToken();
    const toggle = await request(app)
      .post("/auth/registration/toggle")
      .set("Cookie", cookie)
      .set("x-csrf-token", token)
      .send({ enabled: true });

    expect(toggle.status).toBe(200);
    expect(toggle.body.registrationEnabled).toBe(true);
  });

  it("registers a new user when enabled", async () => {
    const cookie = await createAdminSession();
    expect(cookie).toBeTruthy();

    let token = await fetchCsrfToken();
    await request(app)
      .post("/auth/registration/toggle")
      .set("Cookie", cookie)
      .set("x-csrf-token", token)
      .send({ enabled: true });

    token = await fetchCsrfToken();
    const register = await request(app)
      .post("/auth/register")
      .set("x-csrf-token", token)
      .send({ username: "user1", password: "password123" });

    expect(register.status).toBe(201);
    expect(register.body.user.username).toBe("user1");
  });

  it("locks out after repeated failed logins", async () => {
    process.env.LOGIN_RATE_LIMIT_MAX = "100";
    process.env.LOGIN_MAX_FAILURES = "2";

    const token = await fetchCsrfToken();
    await request(app)
      .post("/auth/bootstrap")
      .set("x-csrf-token", token)
      .send({ username: "admin", password: "password123" });

    let loginToken = await fetchCsrfToken();
    await request(app)
      .post("/auth/login")
      .set("x-csrf-token", loginToken)
      .send({ username: "admin", password: "wrong" });

    loginToken = await fetchCsrfToken();
    const locked = await request(app)
      .post("/auth/login")
      .set("x-csrf-token", loginToken)
      .send({ username: "admin", password: "wrong" });

    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe("Account locked");
  });

  it("blocks auth endpoints when disabled", async () => {
    process.env.AUTH_ENABLED = "false";
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = getTestDatabaseUrl();

    // Reset module cache so the new env is read
    vi.resetModules();
    const appModule = (await import("../index")) as { default: unknown };
    const disabledApp = appModule.default;

    const response = await request(disabledApp).post("/auth/login");
    expect(response.status).toBe(404);

    process.env.AUTH_ENABLED = "true";
    vi.resetModules();
  }, 20000);
});
