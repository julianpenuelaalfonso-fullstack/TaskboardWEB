import express from "express";
import request from "supertest";
import { expect, test, vi } from "vitest";
import * as personal from "../src/auth/personalWorkspace.js";
import { envSchema } from "../src/env.js";
import { setClientIpHeader } from "../src/middleware/clientIp.js";
import { PASSWORD } from "./helpers/auth.js";
import { createApp } from "../src/app.js";
import { env } from "../src/env.js";
import { db } from "../src/db/client.js";
import { user } from "../src/db/schema.js";

test("la cabecera de IP del cliente se sobrescribe con req.ip", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(setClientIpHeader);
  app.get("/ip", (req, res) => void res.json({ h: req.headers["x-taskboard-client-ip"] }));
  const res = await request(app).get("/ip").set("x-taskboard-client-ip", "6.6.6.6").set("X-Forwarded-For", "9.9.9.9");
  expect(res.body.h).toBe("9.9.9.9");
});

test("env: producción sin RESEND_API_KEY falla", () => {
  const base = { DATABASE_URL: "x", BETTER_AUTH_SECRET: "s".repeat(32), APP_URL: "http://a.dev", NODE_ENV: "production" };
  expect(envSchema.safeParse(base).success).toBe(false);
  expect(envSchema.safeParse({ ...base, RESEND_API_KEY: "re_x" }).success).toBe(true);
});

test("si falla el workspace personal, el registro sigue respondiendo 200", async () => {
  vi.spyOn(personal, "ensurePersonalWorkspace").mockRejectedValueOnce(new Error("boom"));
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const res = await request(createApp())
    .post("/api/auth/sign-up/email")
    .set("Origin", env.APP_URL)
    .send({ email: "g@test.dev", password: PASSWORD, name: "G" });
  expect(res.status).toBe(200);
  expect(await db.select().from(user)).toHaveLength(1);
  expect(err).toHaveBeenCalled();
  vi.restoreAllMocks();
});
