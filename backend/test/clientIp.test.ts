import request from "supertest";
import { expect, test, vi } from "vitest";
import { createApp, logClientIp } from "../src/app.js";

test("sin DEBUG_CLIENT_IP no se registra nada", async () => {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  await request(createApp()).get("/api/health");
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

test("logClientIp registra solo las primeras peticiones", () => {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  const mw = logClientIp(2);
  const next = vi.fn();
  for (let i = 0; i < 5; i++) mw({ ip: "1.2.3.4", headers: {} } as never, {} as never, next);
  expect(spy).toHaveBeenCalledTimes(2);
  expect(next).toHaveBeenCalledTimes(5);
  spy.mockRestore();
});
