import { describe, expect, test } from "vitest";
import { signUp, signUpWithBoard } from "./helpers/auth.js";

describe("tasks", () => {
  test("acentos y emoji se guardan y vuelven idénticos", async () => {
    const { agent, boardId } = await signUpWithBoard();
    const title = "Leer la guía de Render 🚀 — ñandú";
    await agent.post(`/api/boards/${boardId}/tasks`).send({ title });
    const list = await agent.get(`/api/boards/${boardId}/tasks`);
    expect(list.body[0].title).toBe(title);
  });

  test("crear devuelve 201 con la forma JSON y la lista respeta el orden", async () => {
    const { agent, boardId } = await signUpWithBoard();
    const a = await agent.post(`/api/boards/${boardId}/tasks`).send({ title: "  Primera " });
    expect(a.status).toBe(201);
    expect(a.body).toEqual({ id: expect.any(String), boardId, title: "Primera", done: false, createdAt: expect.any(String) });
    await agent.post(`/api/boards/${boardId}/tasks`).send({ title: "Segunda" });
    const list = await agent.get(`/api/boards/${boardId}/tasks`);
    expect(list.body.map((t: { title: string }) => t.title)).toEqual(["Primera", "Segunda"]);
  });

  test.each([["vacío", ""], ["de 201 caracteres", "x".repeat(201)]])("título %s responde 400 con fields.title", async (_n, title) => {
    const { agent, boardId } = await signUpWithBoard();
    const res = await agent.post(`/api/boards/${boardId}/tasks`).send({ title });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.title).toBeTruthy();
  });

  test("PATCH done no booleano responde 400; completar y reabrir funcionan", async () => {
    const { agent, boardId } = await signUpWithBoard();
    const { id } = (await agent.post(`/api/boards/${boardId}/tasks`).send({ title: "t" })).body;
    expect((await agent.patch(`/api/tasks/${id}`).send({ done: "si" })).status).toBe(400);
    expect((await agent.patch(`/api/tasks/${id}`).send({})).status).toBe(400);
    const done = await agent.patch(`/api/tasks/${id}`).send({ done: true });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ id, boardId, done: true });
    expect((await agent.patch(`/api/tasks/${id}`).send({ done: false })).body.done).toBe(false);
  });

  test("DELETE responde 204 y repetirlo 404", async () => {
    const { agent, boardId } = await signUpWithBoard();
    const { id } = (await agent.post(`/api/boards/${boardId}/tasks`).send({ title: "t" })).body;
    expect((await agent.delete(`/api/tasks/${id}`)).status).toBe(204);
    expect((await agent.delete(`/api/tasks/${id}`)).status).toBe(404);
    expect((await agent.get(`/api/boards/${boardId}/tasks`)).body).toEqual([]);
  });

  test("ids mal formados responden 404", async () => {
    const { agent } = await signUpWithBoard();
    expect((await agent.get("/api/boards/nope/tasks")).status).toBe(404);
    expect((await agent.patch("/api/tasks/nope").send({ done: true })).status).toBe(404);
    expect((await agent.delete("/api/tasks/nope")).status).toBe(404);
  });

  test("aislamiento: B recibe 404 sobre el tablero y las tareas de A, y nada cambia", async () => {
    const a = await signUpWithBoard();
    const { id: taskId } = (await a.agent.post(`/api/boards/${a.boardId}/tasks`).send({ title: "de A" })).body;
    const before = (await a.agent.get(`/api/boards/${a.boardId}/tasks`)).body;
    expect(before).toHaveLength(1);

    const { agent: b } = await signUp();
    expect((await b.get(`/api/boards/${a.boardId}/tasks`)).status).toBe(404);
    expect((await b.post(`/api/boards/${a.boardId}/tasks`).send({ title: "intruso" })).status).toBe(404);
    expect((await b.patch(`/api/tasks/${taskId}`).send({ done: true })).status).toBe(404);
    expect((await b.delete(`/api/tasks/${taskId}`)).status).toBe(404);

    expect((await a.agent.get(`/api/boards/${a.boardId}/tasks`)).body).toEqual(before);
  });
});
