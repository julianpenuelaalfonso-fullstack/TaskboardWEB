import request from "supertest";
import { expect, test } from "vitest";
import { createApp } from "../src/app.js";

test("GET /api/health responde ok", async () => {
  const res = await request(createApp()).get("/api/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok" });
});
test("ruta inexistente responde 404 con forma de error", async () => {
  const res = await request(createApp()).get("/api/nada");
  expect(res.status).toBe(404);
  expect(res.body.error.code).toBe("not_found");
});
test("JSON mal formado responde 400 validation", async () => {
  const res = await request(createApp()).post("/api/health")
    .set("Content-Type", "application/json").send("{mal");
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe("validation");
});
test("incluye cabeceras de helmet", async () => {
  const res = await request(createApp()).get("/api/health");
  expect(res.headers["x-content-type-options"]).toBe("nosniff");
});
