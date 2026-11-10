import { Router } from "express";
import { z } from "zod";
import { nameSchema, uuidParam } from "../validation.js";
import { createWorkspace, deleteWorkspace, listWorkspaces, renameWorkspace } from "./service.js";

const body = z.object({ name: nameSchema });

export const workspacesRouter = Router();

workspacesRouter.get("/", async (req, res) => {
  res.json(await listWorkspaces(req.user!.id));
});

workspacesRouter.post("/", async (req, res) => {
  const { name } = body.parse(req.body);
  res.status(201).json(await createWorkspace(req.user!.id, name));
});

workspacesRouter.patch("/:id", async (req, res) => {
  const id = uuidParam(req.params.id);
  const { name } = body.parse(req.body);
  res.json(await renameWorkspace(req.user!.id, id, name));
});

workspacesRouter.delete("/:id", async (req, res) => {
  await deleteWorkspace(req.user!.id, uuidParam(req.params.id));
  res.status(204).end();
});
