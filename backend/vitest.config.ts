import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.integration.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      NODE_ENV: "test",
      // Keep tests hermetic even if developers run the app locally with OIDC enabled in their shell/.env.
      AUTH_MODE: "local",
    },
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
