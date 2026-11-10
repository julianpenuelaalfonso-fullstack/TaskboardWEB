import { Router } from "express";
import { z } from "zod";
import { colorSchema, nameSchema, uuidParam } from "../validation.js";
import { createBoard, deleteBoard, getBoard, listArchivedBoards, listBoards, updateBoard } from "./service.js";

const createBody = z.object({ name: nameSchema, color: colorSchema.default("cobalt") });
const patchBody = z
  .object({ name: nameSchema, color: colorSchema, archived: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Indica al menos un campo");
const listQuery = z.object({ archived: z.enum(["true", "false"]).default("false") });

/** Montado en /api/workspaces. */
export const workspaceBoardsRouter = Router();

workspaceBoardsRouter.get("/:id/boards", async (req, res) => {
  const id = uuidParam(req.params.id);
  const { archived } = listQuery.parse(req.query);
  res.json(await listBoards(req.user!.id, id, archived === "true"));
});

workspaceBoardsRouter.post("/:id/boards", async (req, res) => {
  const id = uuidParam(req.params.id);
  const { name, color } = createBody.parse(req.body);
  res.status(201).json(await createBoard(req.user!.id, id, name, color));
});

/** Montado en /api/boards. `/archived` va antes de `/:id`. */
export const boardsRouter = Router();

boardsRouter.get("/archived", async (req, res) => {
  res.json(await listArchivedBoards(req.user!.id));
});

boardsRouter.get("/:id", async (req, res) => {
  res.json(await getBoard(req.user!.id, uuidParam(req.params.id)));
});

boardsRouter.patch("/:id", async (req, res) => {
  const id = uuidParam(req.params.id);
  res.json(await updateBoard(req.user!.id, id, patchBody.parse(req.body)));
});

boardsRouter.delete("/:id", async (req, res) => {
  await deleteBoard(req.user!.id, uuidParam(req.params.id));
  res.status(204).end();
});
