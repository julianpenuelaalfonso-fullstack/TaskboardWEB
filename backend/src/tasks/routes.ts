import { Router } from "express";
import { z } from "zod";
import { titleSchema, uuidParam } from "../validation.js";
import { createTask, deleteTask, listTasks, setTaskDone } from "./service.js";

const createBody = z.object({ title: titleSchema });
const patchBody = z.object({ done: z.boolean() });

/** Montado en /api/boards (después de boardsRouter). */
export const boardTasksRouter = Router();

boardTasksRouter.get("/:id/tasks", async (req, res) => {
  res.json(await listTasks(req.user!.id, uuidParam(req.params.id)));
});

boardTasksRouter.post("/:id/tasks", async (req, res) => {
  const id = uuidParam(req.params.id);
  res.status(201).json(await createTask(req.user!.id, id, createBody.parse(req.body).title));
});

/** Montado en /api/tasks. */
export const tasksRouter = Router();

tasksRouter.patch("/:id", async (req, res) => {
  const id = uuidParam(req.params.id);
  res.json(await setTaskDone(req.user!.id, id, patchBody.parse(req.body).done));
});

tasksRouter.delete("/:id", async (req, res) => {
  await deleteTask(req.user!.id, uuidParam(req.params.id));
  res.status(204).end();
});
