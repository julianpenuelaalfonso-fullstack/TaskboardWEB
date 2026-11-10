import { eq } from "drizzle-orm";
import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { createApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import { workspaceMembers, workspaces } from "../../src/db/schema.js";
import { env } from "../../src/env.js";

export const PASSWORD = "clave-segura-123";

export async function signUp(email = `${crypto.randomUUID()}@test.dev`): Promise<{ agent: TestAgent; userId: string }> {
  const agent = request.agent(createApp());
  const res = await agent
    .post("/api/auth/sign-up/email")
    .set("Origin", env.APP_URL)
    .send({ email, password: PASSWORD, name: "Test" });
  if (res.status !== 200) throw new Error(`signUp falló: ${res.status} ${res.text}`);
  return { agent, userId: res.body.user.id as string };
}

export async function signUpWithBoard(): Promise<{ agent: TestAgent; userId: string; workspaceId: string; boardId: string }> {
  const { agent, userId } = await signUp();
  const [ws] = (await agent.get("/api/workspaces")).body;
  const res = await agent.post(`/api/workspaces/${ws.id}/boards`).send({ name: "Tablero de prueba" });
  if (res.status !== 201) throw new Error(`signUpWithBoard falló: ${res.status} ${res.text}`);
  return { agent, userId, workspaceId: ws.id as string, boardId: res.body.id as string };
}

export function membershipsOf(userId: string) {
  return db
    .select({ role: workspaceMembers.role, isPersonal: workspaces.isPersonal, name: workspaces.name })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId));
}

export function extractToken(text: string): string {
  const url = text.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error("El correo no contiene enlace");
  // Better Auth envía /reset-password/<token>?callbackURL=...
  const token = new URL(url).pathname.split("/").pop();
  if (!token) throw new Error("El enlace no contiene token");
  return token;
}
