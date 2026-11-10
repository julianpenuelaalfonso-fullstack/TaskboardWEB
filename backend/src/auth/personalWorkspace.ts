import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { workspaceMembers, workspaces } from "../db/schema.js";

/** Devuelve el id del workspace personal del usuario, creándolo si falta. Idempotente bajo concurrencia. */
export async function ensurePersonalWorkspace(userId: string): Promise<string> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    const [existing] = await tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(and(eq(workspaces.isPersonal, true), eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner")))
      .limit(1);
    if (existing) return existing.id;
    const [created] = await tx.insert(workspaces).values({ name: "Personal", isPersonal: true }).returning({ id: workspaces.id });
    await tx.insert(workspaceMembers).values({ workspaceId: created.id, userId, role: "owner" });
    return created.id;
  });
}
