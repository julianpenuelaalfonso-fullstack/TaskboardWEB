import { asc, eq } from "drizzle-orm";
import { requireBoardAccess, requireTaskAccess, type Task } from "../access.js";
import { db } from "../db/client.js";
import { tasks } from "../db/schema.js";
import { NotFoundError } from "../errors.js";

const toJson = (t: Task) => ({
  id: t.id,
  boardId: t.boardId,
  title: t.title,
  done: t.done,
  createdAt: t.createdAt.toISOString(),
});

export async function listTasks(userId: string, boardId: string) {
  await requireBoardAccess(userId, boardId);
  const rows = await db.select().from(tasks).where(eq(tasks.boardId, boardId)).orderBy(asc(tasks.createdAt), asc(tasks.id));
  return rows.map(toJson);
}

export async function createTask(userId: string, boardId: string, title: string) {
  await requireBoardAccess(userId, boardId);
  const [row] = await db.insert(tasks).values({ boardId, title }).returning();
  return toJson(row);
}

export async function setTaskDone(userId: string, id: string, done: boolean) {
  await requireTaskAccess(userId, id);
  const [row] = await db.update(tasks).set({ done }).where(eq(tasks.id, id)).returning();
  if (!row) throw new NotFoundError(); // borrada entre el chequeo y la escritura
  return toJson(row);
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  await requireTaskAccess(userId, id);
  const rows = await db.delete(tasks).where(eq(tasks.id, id)).returning({ id: tasks.id });
  if (rows.length === 0) throw new NotFoundError();
}
