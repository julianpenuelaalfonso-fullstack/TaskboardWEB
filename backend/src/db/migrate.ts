import { fileURLToPath } from "node:url";
import { migrate as run } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

export async function migrate(): Promise<void> {
  await run(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().then(() => pool.end(), (e) => { console.error(e); process.exit(1); });
}
