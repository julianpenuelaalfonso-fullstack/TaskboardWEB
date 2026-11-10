import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../errors.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
    res.status(400).json({ error: { code: "validation", message: "Datos no válidos", fields } });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // body-parser: JSON mal formado
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "validation", message: "JSON mal formado" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "internal", message: "Error interno del servidor" } });
};
