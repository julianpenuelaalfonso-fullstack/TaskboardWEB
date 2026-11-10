import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { requireBoardAccess, requireWorkspaceMember, type Board } from "../access.js";
import { db } from "../db/client.js";
import { boards, workspaceMembers, workspaces } from "../db/schema.js";
import { NotFoundError } from "../errors.js";

export type BoardPatch = { name?: string; color?: Board["color"]; archived?: boolean };

const toJson = (b: Board) => ({
  id: b.id,
  workspaceId: b.workspaceId,
  name: b.name,
  color: b.color,
  archivedAt: b.archivedAt ? b.archivedAt.toISOString() : null,
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

export async function listBoards(userId: string, workspaceId: string, archived: boolean) {
  await requireWorkspaceMember(userId, workspaceId);
  const rows = await db
    .select()
    .from(boards)
    .where(and(eq(boards.workspaceId, workspaceId), archived ? isNotNull(boards.archivedAt) : isNull(boards.archivedAt)))
    .orderBy(asc(boards.createdAt));
  return rows.map(toJson);
}

export async function listArchivedBoards(userId: string) {
  const rows = await db
    .select({ board: boards, workspaceName: workspaces.name })
    .from(boards)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, boards.workspaceId))
    .innerJoin(workspaces, eq(workspaces.id, boards.workspaceId))
    .where(and(eq(workspaceMembers.userId, userId), isNotNull(boards.archivedAt)))
    .orderBy(asc(boards.archivedAt));
  return rows.map((r) => ({ ...toJson(r.board), workspaceName: r.workspaceName }));
}

export async function getBoard(userId: string, id: string) {
  const { board } = await requireBoardAccess(userId, id);
  const [ws] = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, board.workspaceId));
  if (!ws) throw new NotFoundError();
  return { ...toJson(board), workspaceName: ws.name };
}

export async function createBoard(userId: string, workspaceId: string, name: string, color: Board["color"]) {
  await requireWorkspaceMember(userId, workspaceId);
  const [row] = await db.insert(boards).values({ workspaceId, name, color }).returning();
  return toJson(row);
}

export async function updateBoard(userId: string, id: string, patch: BoardPatch) {
  await requireBoardAccess(userId, id);
  const { archived, ...rest } = patch;
  const set = {
    ...rest,
    ...(archived === undefined ? {} : { archivedAt: archived ? sql`now()` : null }),
    updatedAt: sql`now()`,
  };
  const [row] = await db.update(boards).set(set).where(eq(boards.id, id)).returning();
  if (!row) throw new NotFoundError(); // borrado entre el chequeo y la escritura
  return toJson(row);
}

export async function deleteBoard(userId: string, id: string): Promise<void> {
  await requireBoardAccess(userId, id);
  const rows = await db.delete(boards).where(eq(boards.id, id)).returning({ id: boards.id });
  if (rows.length === 0) throw new NotFoundError();
}
