import type { RequestHandler } from "express";

export const CLIENT_IP_HEADER = "x-taskboard-client-ip";

// Better Auth ignora `trust proxy`; le damos la IP ya resuelta por Express (TRUST_PROXY_HOPS) y
// descartamos cualquier valor enviado por el cliente.
export const setClientIpHeader: RequestHandler = (req, _res, next) => {
  req.headers[CLIENT_IP_HEADER] = req.ip ?? "";
  next();
};
