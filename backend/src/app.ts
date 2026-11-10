import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth/auth.js";
import { setClientIpHeader } from "./middleware/clientIp.js";
import { env } from "./env.js";
import { NotFoundError } from "./errors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireSession } from "./middleware/requireSession.js";
import { boardsRouter, workspaceBoardsRouter } from "./boards/routes.js";
import { boardTasksRouter, tasksRouter } from "./tasks/routes.js";
import { workspacesRouter } from "./workspaces/routes.js";

export function createApp(): express.Express {
  const app = express();
  // Número exacto de proxies delante de la API (nunca `true`: permitiría falsificar X-Forwarded-For).
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
  app.use(helmet());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      handler: (_req, res) => {
        res.status(429).json({ error: { code: "rate_limited", message: "Demasiadas peticiones" } });
      },
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Orden obligatorio para las siguientes tareas:
  // 1. Aquí, ANTES de express.json(): handler de Better Auth (app.all("/api/auth/*splat", ...)).
  app.use("/api/auth", setClientIpHeader);
  app.all("/api/auth/*splat", toNodeHandler(auth));
  app.use(express.json());
  // 2. Aquí: routers autenticados.
  app.use("/api/workspaces", requireSession, workspacesRouter);
  app.use("/api/workspaces", requireSession, workspaceBoardsRouter);
  app.use("/api/boards", requireSession, boardsRouter);
  app.use("/api/boards", requireSession, boardTasksRouter);
  app.use("/api/tasks", requireSession, tasksRouter);
  // 3. Al final: 404 de /api y errorHandler.
  app.use("/api", () => {
    throw new NotFoundError();
  });
  app.use(errorHandler);

  return app;
}
