import { describe, expect, test } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { boards, tasks, workspaces } from "../src/db/schema.js";
import { requireBoardAccess, requireTaskAccess } from "../src/access.js";
import { NotFoundError } from "../src/errors.js";
import { signUp } from "./helpers/auth.js";

describe("workspaces", () => {
  test("sin sesión responde 401", async () => {
    const res = await request(createApp()).get("/api/workspaces");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  test("crear, listar y renombrar", async () => {
    const { agent } = await signUp();
    const created = await agent.post("/api/workspaces").send({ name: "  Equipo X  " });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Equipo X");
    expect(created.body.role).toBe("owner");
    const list = await agent.get("/api/workspaces");
    expect(list.body.map((w: { name: string }) => w.name)).toEqual(["Personal", "Equipo X"]);
    const renamed = await agent.patch(`/api/workspaces/${created.body.id}`).send({ name: "Equipo Y" });
    expect(renamed.body.name).toBe("Equipo Y");
  });

  test("nombre vacío o de 101 caracteres responde 400 con fields.name", async () => {
    const { agent } = await signUp();
    for (const name of ["   ", "x".repeat(101)]) {
      const res = await agent.post("/api/workspaces").send({ name });
      expect(res.status).toBe(400);
      expect(res.body.error.fields.name).toBeTruthy();
    }
  });

  test("no se puede eliminar el workspace personal", async () => {
    const { agent } = await signUp();
    const [personal] = (await agent.get("/api/workspaces")).body;
    const res = await agent.delete(`/api/workspaces/${personal.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("No puedes eliminar tu espacio personal");
  });

  test("aislamiento: B recibe 404 sobre el workspace de A", async () => {
    const a = await signUp("a@test.dev");
    const b = await signUp("b@test.dev");
    const ws = (await a.agent.post("/api/workspaces").send({ name: "Privado" })).body;
    expect((await b.agent.patch(`/api/workspaces/${ws.id}`).send({ name: "x" })).status).toBe(404);
    expect((await b.agent.delete(`/api/workspaces/${ws.id}`)).status).toBe(404);
    expect((await b.agent.get(`/api/workspaces/${ws.id}/boards`)).status).toBe(404);
    expect((await b.agent.get("/api/workspaces")).body.map((w: { id: string }) => w.id)).not.toContain(ws.id);
  });

  test("id mal formado responde 404", async () => {
    const { agent } = await signUp();
    expect((await agent.patch("/api/workspaces/123").send({ name: "x" })).status).toBe(404);
  });

  test("requireBoardAccess y requireTaskAccess: el miembro accede, el ajeno recibe 404", async () => {
    const a = await signUp();
    const b = await signUp();
    const [ws] = (await a.agent.get("/api/workspaces")).body;
    const [board] = await db.insert(boards).values({ workspaceId: ws.id, name: "T", color: "teal" }).returning();
    const [task] = await db.insert(tasks).values({ boardId: board.id, title: "t" }).returning();
    expect((await requireBoardAccess(a.userId, board.id)).role).toBe("owner");
    expect((await requireTaskAccess(a.userId, task.id)).boardId).toBe(board.id);
    await expect(requireBoardAccess(b.userId, board.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(requireTaskAccess(b.userId, task.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  test("borrar un workspace elimina tableros y tareas en cascada", async () => {
    const { agent } = await signUp();
    const ws = (await agent.post("/api/workspaces").send({ name: "Temporal" })).body;
    const [board] = await db.insert(boards).values({ workspaceId: ws.id, name: "T", color: "teal" }).returning();
    await db.insert(tasks).values({ boardId: board.id, title: "t" });
    expect((await agent.delete(`/api/workspaces/${ws.id}`)).status).toBe(204);
    expect(await db.select().from(boards)).toHaveLength(0);
    expect(await db.select().from(tasks)).toHaveLength(0);
    expect((await db.select().from(workspaces)).some((w) => w.id === ws.id)).toBe(false);
  });

  // Se activa en la Tarea 5, cuando existan las rutas de tableros.
  test.todo("borrar un workspace con tableros no deja huérfanos (vía rutas /boards)");
});
