import { and, eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { boards, tasks, workspaceMembers, workspaces, type ROLES } from "./db/schema.js";
import { NotFoundError } from "./errors.js";

export type Role = (typeof ROLES)[number];
export type Board = typeof boards.$inferSelect;
export type Task = typeof tasks.$inferSelect;

// Único camino para cargar un recurso por id: todo hace JOIN con workspace_members.
// Sin fila (ajeno o inexistente) -> 404 idéntico.

export async function requireWorkspaceMember(userId: string, workspaceId: string): Promise<{ role: Role; isPersonal: boolean }> {
  const [row] = await db
    .select({ role: workspaceMembers.role, isPersonal: workspaces.isPersonal })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
  if (!row) throw new NotFoundError();
  return row;
}

export async function requireBoardAccess(userId: string, boardId: string): Promise<{ board: Board; role: Role }> {
  const [row] = await db
    .select({ board: boards, role: workspaceMembers.role })
    .from(boards)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, boards.workspaceId))
    .where(and(eq(boards.id, boardId), eq(workspaceMembers.userId, userId)));
  if (!row) throw new NotFoundError();
  return row;
}

export async function requireTaskAccess(userId: string, taskId: string): Promise<{ task: Task; boardId: string; role: Role }> {
  const [row] = await db
    .select({ task: tasks, role: workspaceMembers.role })
    .from(tasks)
    .innerJoin(boards, eq(boards.id, tasks.boardId))
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, boards.workspaceId))
    .where(and(eq(tasks.id, taskId), eq(workspaceMembers.userId, userId)));
  if (!row) throw new NotFoundError();
  return { task: row.task, boardId: row.task.boardId, role: row.role };
}
