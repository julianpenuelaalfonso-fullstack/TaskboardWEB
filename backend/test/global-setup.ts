// globalSetup corre en el proceso principal, sin el `test.env` de vitest.config.ts.
export default async function setup() {
  Object.assign(process.env, {
    NODE_ENV: "test",
    TEST_DATABASE_URL: "postgresql://taskboard:taskboard_local@127.0.0.1:15432/taskboard_test",
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-32",
    APP_URL: "http://localhost:5183",
  });
  const { pool } = await import("../src/db/client.js");
  const { migrate } = await import("../src/db/migrate.js");
  await migrate();
  await pool.end();
}
