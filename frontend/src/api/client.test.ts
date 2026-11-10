import { afterEach, expect, it, vi } from "vitest";
import { ApiError, apiFetch, setUnauthorizedHandler } from "./client";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

it("un 400 con fields produce ApiError con esos fields", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    json(400, { error: { code: "validation", message: "Datos no válidos", fields: { title: "Obligatorio" } } })
  ));
  const err = await apiFetch("/tasks").catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 400, code: "validation", fields: { title: "Obligatorio" } });
});

it("un fetch rechazado produce code network y status 0", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  await expect(apiFetch("/tasks")).rejects.toMatchObject({ status: 0, code: "network" });
});

it("un 401 llama al handler registrado", async () => {
  const handler = vi.fn();
  setUnauthorizedHandler(handler);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, { error: { code: "unauthorized", message: "x" } })));
  await expect(apiFetch("/me")).rejects.toMatchObject({ status: 401 });
  expect(handler).toHaveBeenCalledOnce();
});

it("usa /api, same-origin y devuelve el JSON", async () => {
  const f = vi.fn().mockResolvedValue(json(200, { ok: 1 }));
  vi.stubGlobal("fetch", f);
  await expect(apiFetch("/tasks")).resolves.toEqual({ ok: 1 });
  expect(f).toHaveBeenCalledWith("/api/tasks", expect.objectContaining({ credentials: "same-origin" }));
});
