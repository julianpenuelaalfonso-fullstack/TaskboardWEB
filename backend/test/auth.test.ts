import express from "express";
import request from "supertest";
import { expect, test } from "vitest";
import { sentEmails } from "../src/auth/email.js";
import { ensurePersonalWorkspace } from "../src/auth/personalWorkspace.js";
import { createApp } from "../src/app.js";
import { env } from "../src/env.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { requireSession } from "../src/middleware/requireSession.js";
import { extractToken, membershipsOf, signUp } from "./helpers/auth.js";

test("registrarse crea el workspace personal con rol owner", async () => {
  const { userId } = await signUp("ana@test.dev");
  const rows = await membershipsOf(userId);
  expect(rows).toEqual([expect.objectContaining({ role: "owner", isPersonal: true, name: "Personal" })]);
});

test("ensurePersonalWorkspace es idempotente", async () => {
  const { userId } = await signUp();
  const [a, b] = await Promise.all([ensurePersonalWorkspace(userId), ensurePersonalWorkspace(userId)]);
  expect(a).toBe(b);
  expect(await membershipsOf(userId)).toHaveLength(1);
});

test("contraseña de 9 caracteres se rechaza", async () => {
  const res = await request(createApp())
    .post("/api/auth/sign-up/email")
    .set("Origin", env.APP_URL)
    .send({ email: "b@test.dev", password: "123456789", name: "B" });
  expect(res.status).toBe(400);
});

test("login con contraseña incorrecta falla", async () => {
  await signUp("c@test.dev");
  const res = await request(createApp())
    .post("/api/auth/sign-in/email")
    .set("Origin", env.APP_URL)
    .send({ email: "c@test.dev", password: "otra-clave-999" });
  expect(res.status).toBe(401);
});

test("recuperar contraseña: enlace de un solo uso", async () => {
  await signUp("d@test.dev");
  await request(createApp())
    .post("/api/auth/request-password-reset")
    .set("Origin", env.APP_URL)
    .send({ email: "d@test.dev", redirectTo: "/restablecer" });
  await expect.poll(() => sentEmails.length).toBeGreaterThan(0);
  const token = extractToken(sentEmails.at(-1)!.text);
  const reset = (pw: string) =>
    request(createApp()).post("/api/auth/reset-password").set("Origin", env.APP_URL).send({ token, newPassword: pw });
  expect((await reset("nueva-clave-123")).status).toBe(200);
  expect((await reset("otra-nueva-456")).status).toBe(400);
});

test("restablecer la contraseña revoca las sesiones abiertas", async () => {
  const { agent } = await signUp("rev@test.dev");
  expect((await agent.get("/api/workspaces")).status).toBe(200);
  const before = sentEmails.length;
  await request(createApp())
    .post("/api/auth/request-password-reset")
    .set("Origin", env.APP_URL)
    .send({ email: "rev@test.dev", redirectTo: "/restablecer" });
  await expect.poll(() => sentEmails.length).toBeGreaterThan(before);
  const token = extractToken(sentEmails.at(-1)!.text);
  const res = await request(createApp()).post("/api/auth/reset-password").set("Origin", env.APP_URL).send({ token, newPassword: "nueva-clave-123" });
  expect(res.status).toBe(200);
  expect((await agent.get("/api/workspaces")).status).toBe(401);
});

test("recuperar con correo inexistente responde igual que con uno existente", async () => {
  await signUp("e@test.dev");
  const send = (email: string) =>
    request(createApp())
      .post("/api/auth/request-password-reset")
      .set("Origin", env.APP_URL)
      .send({ email, redirectTo: "/restablecer" });
  const [a, b] = await Promise.all([send("e@test.dev"), send("nadie@test.dev")]);
  expect(a.status).toBe(b.status);
  expect(a.body).toEqual(b.body);
});

test("requireSession: 401 sin cookie y req.user con sesión válida", async () => {
  const app = express();
  app.get("/me", requireSession, (req, res) => void res.json(req.user));
  app.use(errorHandler);
  const signup = await request(createApp())
    .post("/api/auth/sign-up/email")
    .set("Origin", env.APP_URL)
    .send({ email: "f@test.dev", password: "clave-segura-123", name: "Test" });
  const cookie = (signup.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0]).join("; ");
  expect((await request(app).get("/me")).status).toBe(401);
  const res = await request(app).get("/me").set("Cookie", cookie);
  expect(res.body).toEqual({ id: expect.any(String), email: "f@test.dev", name: "Test" });
});
