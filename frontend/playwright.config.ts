import { defineConfig, devices } from "@playwright/test";

const DB = "postgresql://taskboard:taskboard_local@127.0.0.1:15432/taskboard_test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:5183", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL } }],
  webServer: [
    {
      // Migra taskboard_test y levanta la API; NO ejecutar a la vez que los tests del backend (hacen TRUNCATE).
      command: "npm run migrate && npx tsx src/index.ts",
      cwd: "../backend",
      url: "http://localhost:3012/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: "test",
        TEST_DATABASE_URL: DB,
        BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-32chars",
        APP_URL: "http://localhost:5183",
        PORT: "3012"
      }
    },
    {
      command: "npx vite --port 5183 --strictPort",
      url: "http://localhost:5183",
      reuseExistingServer: !process.env.CI,
      env: { API_PROXY_TARGET: "http://localhost:3012" }
    }
  ]
});
