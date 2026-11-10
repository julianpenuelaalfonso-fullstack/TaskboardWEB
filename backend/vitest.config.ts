import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false, // todos los archivos comparten taskboard_test y resetDb hace TRUNCATE
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup.ts"],
    include: ["test/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgresql://taskboard:taskboard_local@127.0.0.1:15432/taskboard_test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-32",
      TRUST_PROXY_HOPS: "1",
      APP_URL: "http://localhost:5183",
      EMAIL_FROM: "TaskBoard <no-reply@taskboard.local>",
    },
  },
});
