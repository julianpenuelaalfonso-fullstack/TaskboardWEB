import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "../src/db/client.js";
import { boards, tasks, user, workspaceMembers, workspaces } from "../src/db/schema.js";

async function seedUser() {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name: "Ana", email: `${id}@example.com` });
  return id;
}

async function seedWorkspace() {
  const [w] = await db.insert(workspaces).values({ name: "Personal" }).returning();
  return w.id;
}

// Drizzle envuelve el error de pg; el texto "check constraint" vive en `cause`.
async function unwrap<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    throw (e as Error).cause ?? e;
  }
}

async function insertMember(over: { role: string }) {
  return unwrap(
    db
      .insert(workspaceMembers)
      .values({ workspaceId: await seedWorkspace(), userId: await seedUser(), role: over.role as "owner" }),
  );
}

async function insertBoard(over: { color: string }) {
  return unwrap(
    db.insert(boards).values({ workspaceId: await seedWorkspace(), name: "B", color: over.color as "cobalt" }),
  );
}

async function seedWorkspaceWithBoardAndTask() {
  const workspaceId = await seedWorkspace();
  const [b] = await db.insert(boards).values({ workspaceId, name: "B", color: "cobalt" }).returning();
  await db.insert(tasks).values({ boardId: b.id, title: "T" });
  return { workspaceId, boardId: b.id };
}

test("rechaza un rol fuera de la lista", async () => {
  await expect(insertMember({ role: "superadmin" })).rejects.toThrow(/check/i);
});

test("rechaza un color fuera de la paleta", async () => {
  await expect(insertBoard({ color: "pink" })).rejects.toThrow(/check/i);
});

test("borrar un workspace borra sus tableros y tareas", async () => {
  const { workspaceId, boardId } = await seedWorkspaceWithBoardAndTask();
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  expect(await db.select().from(boards).where(eq(boards.id, boardId))).toHaveLength(0);
  expect(await db.select().from(tasks).where(eq(tasks.boardId, boardId))).toHaveLength(0);
});
