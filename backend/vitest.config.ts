import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgresql://taskboard:taskboard_local@127.0.0.1:15432/taskboard_test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-32",
      APP_URL: "http://localhost:5183",
      EMAIL_FROM: "TaskBoard <no-reply@taskboard.local>",
    },
  },
});
