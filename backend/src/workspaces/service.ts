import { asc, desc, eq } from "drizzle-orm";
import { requireWorkspaceMember } from "../access.js";
import { ensurePersonalWorkspace } from "../auth/personalWorkspace.js";
import { db } from "../db/client.js";
import { workspaceMembers, workspaces } from "../db/schema.js";
import { ConflictError, NotFoundError } from "../errors.js";

export async function listWorkspaces(userId: string) {
  await ensurePersonalWorkspace(userId); // red de seguridad si falló el hook de registro
  return db
    .select({ id: workspaces.id, name: workspaces.name, isPersonal: workspaces.isPersonal, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(desc(workspaces.isPersonal), asc(workspaces.createdAt));
}

export async function createWorkspace(userId: string, name: string) {
  return db.transaction(async (tx) => {
    const [ws] = await tx.insert(workspaces).values({ name }).returning();
    await tx.insert(workspaceMembers).values({ workspaceId: ws.id, userId, role: "owner" });
    return { id: ws.id, name: ws.name, isPersonal: ws.isPersonal, role: "owner" as const };
  });
}

export async function renameWorkspace(userId: string, id: string, name: string) {
  const { role } = await requireWorkspaceMember(userId, id);
  const [ws] = await db.update(workspaces).set({ name }).where(eq(workspaces.id, id)).returning();
  if (!ws) throw new NotFoundError(); // borrado entre el chequeo y la escritura
  return { id: ws.id, name: ws.name, isPersonal: ws.isPersonal, role };
}

export async function deleteWorkspace(userId: string, id: string): Promise<void> {
  const { isPersonal } = await requireWorkspaceMember(userId, id);
  if (isPersonal) throw new ConflictError("No puedes eliminar tu espacio personal");
  await db.delete(workspaces).where(eq(workspaces.id, id)); // cascada: miembros, tableros, tareas
}
