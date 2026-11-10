import { describe, expect, test } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { signUp, signUpWithBoard } from "./helpers/auth.js";

type B = { id: string };
const ids = (body: B[]) => body.map((b) => b.id);

describe("boards", () => {
  test("crear con color por defecto cobalt", async () => {
    const { agent, workspaceId } = await signUpWithBoard();
    const res = await agent.post(`/api/workspaces/${workspaceId}/boards`).send({ name: "  Nuevo " });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ workspaceId, name: "Nuevo", color: "cobalt", archivedAt: null });
    expect(typeof res.body.createdAt).toBe("string");
  });

  test("color inválido responde 400 con fields.color", async () => {
    const { agent, workspaceId } = await signUpWithBoard();
    const res = await agent.post(`/api/workspaces/${workspaceId}/boards`).send({ name: "x", color: "pink" });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.color).toBeTruthy();
  });

  test("archivar y restaurar", async () => {
    const { agent, workspaceId, boardId } = await signUpWithBoard();
    const arch = await agent.patch(`/api/boards/${boardId}`).send({ archived: true });
    expect(arch.status).toBe(200);
    expect(arch.body.archivedAt).toEqual(expect.any(String));
    expect(ids((await agent.get(`/api/workspaces/${workspaceId}/boards`)).body)).not.toContain(boardId);
    expect(ids((await agent.get(`/api/workspaces/${workspaceId}/boards?archived=true`)).body)).toContain(boardId);
    const all = await agent.get("/api/boards/archived");
    expect(all.status).toBe(200);
    expect(all.body.find((b: B) => b.id === boardId).workspaceName).toBe("Personal");
    const rest = await agent.patch(`/api/boards/${boardId}`).send({ archived: false });
    expect(rest.body.archivedAt).toBeNull();
    expect(ids((await agent.get(`/api/workspaces/${workspaceId}/boards`)).body)).toContain(boardId);
    expect((await agent.get("/api/boards/archived")).body).toEqual([]);
  });

  test("GET /api/boards/archived no se confunde con un id", async () => {
    const { agent } = await signUp();
    const res = await agent.get("/api/boards/archived");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("GET /api/boards/:id incluye workspaceName", async () => {
    const { agent, boardId } = await signUpWithBoard();
    const res = await agent.get(`/api/boards/${boardId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: boardId, name: "Tablero de prueba", workspaceName: "Personal" });
  });

  test("PATCH renombra, cambia color y actualiza updatedAt", async () => {
    const { agent, boardId } = await signUpWithBoard();
    const before = (await agent.get(`/api/boards/${boardId}`)).body;
    const res = await agent.patch(`/api/boards/${boardId}`).send({ name: "Otro", color: "teal" });
    expect(res.body).toMatchObject({ name: "Otro", color: "teal" });
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime());
  });

  test("PATCH {} o archived no booleano responde 400", async () => {
    const { agent, boardId } = await signUpWithBoard();
    expect((await agent.patch(`/api/boards/${boardId}`).send({})).status).toBe(400);
    expect((await agent.patch(`/api/boards/${boardId}`).send({ archived: "yes" })).status).toBe(400);
  });

  test("aislamiento: B recibe 404 sobre el tablero y el workspace de A", async () => {
    const a = await signUpWithBoard();
    const b = await signUp();
    expect((await b.agent.get(`/api/boards/${a.boardId}`)).status).toBe(404);
    expect((await b.agent.patch(`/api/boards/${a.boardId}`).send({ name: "x" })).status).toBe(404);
    expect((await b.agent.delete(`/api/boards/${a.boardId}`)).status).toBe(404);
    expect((await b.agent.get(`/api/workspaces/${a.workspaceId}/boards`)).status).toBe(404);
    expect((await b.agent.post(`/api/workspaces/${a.workspaceId}/boards`).send({ name: "x" })).status).toBe(404);
    expect((await a.agent.get(`/api/boards/${a.boardId}`)).body.name).toBe("Tablero de prueba");
    await a.agent.patch(`/api/boards/${a.boardId}`).send({ archived: true });
    const mine = (await a.agent.get("/api/boards/archived")).body;
    expect(mine.find((x: B) => x.id === a.boardId).workspaceName).toBe("Personal");
    expect(ids((await b.agent.get("/api/boards/archived")).body)).not.toContain(a.boardId);
  });

  test("DELETE responde 204 y después 404", async () => {
    const { agent, boardId } = await signUpWithBoard();
    expect((await agent.delete(`/api/boards/${boardId}`)).status).toBe(204);
    expect((await agent.delete(`/api/boards/${boardId}`)).status).toBe(404);
    expect((await agent.get(`/api/boards/${boardId}`)).status).toBe(404);
  });

  test("sin sesión responde 401", async () => {
    expect((await request(createApp()).get("/api/boards/archived")).status).toBe(401);
  });
});
