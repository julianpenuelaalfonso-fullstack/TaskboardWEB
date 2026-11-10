import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/auth.js";
import { UnauthorizedError } from "../errors.js";

export const requireSession: RequestHandler = async (req, _res, next) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedError();
    const { id, email, name } = session.user;
    req.user = { id, email, name };
    next();
  } catch (err) {
    next(err);
  }
};
