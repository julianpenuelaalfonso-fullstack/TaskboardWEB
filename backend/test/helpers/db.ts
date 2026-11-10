import { sql } from "drizzle-orm";
import { db } from "../../src/db/client.js";

const TABLES = ["tasks", "boards", "workspace_members", "workspaces", "verification", "account", "session", '"user"'];

export async function resetDb(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} CASCADE`));
}
