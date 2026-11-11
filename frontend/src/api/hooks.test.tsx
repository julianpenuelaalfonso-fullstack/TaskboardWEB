import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBoards, useBoard } from "./boards";
import { useDeleteWorkspace, useWorkspaces } from "./workspaces";
import { useTasks, useToggleTask } from "./tasks";
import type { Board, Task } from "./types";

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const board = (over: Partial<Board> = {}): Board => ({
  id: "b1", workspaceId: "w1", name: "Tablero", color: "cobalt", archivedAt: null, createdAt: "", updatedAt: "", ...over
});
const task: Task = { id: "t1", boardId: "b1", title: "Tarea", done: false, createdAt: "" };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

afterEach(() => vi.unstubAllGlobals());

it("useBoard lee GET /api/boards/:id con la clave [board, id]", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, { ...board(), workspaceName: "Personal" }));
  vi.stubGlobal("fetch", fetchMock);
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useBoard("b1"), { wrapper });
  await waitFor(() => expect(result.current.data?.workspaceName).toBe("Personal"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/boards/b1");
  expect(client.getQueryData(["board", "b1"])).toBeDefined();
});

it("useDeleteWorkspace deja de mostrar los tableros de ese workspace en useBoards", async () => {
  let deleted = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") { deleted = true; return json(204); }
    if (url === "/api/workspaces") {
      return json(200, deleted ? [] : [{ id: "w1", name: "Equipo", isPersonal: false, role: "owner" }]);
    }
    if (url.startsWith("/api/workspaces/w1/boards")) return deleted ? json(404, { error: { code: "not_found", message: "x" } }) : json(200, [board()]);
    return json(404, { error: { code: "not_found", message: "x" } });
  }));
  const { client, wrapper } = setup();
  const boards = renderHook(() => useBoards("w1"), { wrapper });
  const ws = renderHook(() => useWorkspaces(), { wrapper });
  const del = renderHook(() => useDeleteWorkspace(), { wrapper });
  await waitFor(() => expect(boards.result.current.data).toHaveLength(1));
  await waitFor(() => expect(ws.result.current.data).toHaveLength(1));

  await act(() => del.result.current.mutateAsync("w1"));

  await waitFor(() => expect(ws.result.current.data).toEqual([]));
  expect(client.getQueryData(["boards", "w1", false])).toBeUndefined();
});

it("useToggleTask revierte done si la API responde 500", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") { await gate; return json(500, { error: { code: "internal", message: "boom" } }); }
    return json(200, [task]);
  }));
  const { wrapper } = setup();
  const tasks = renderHook(() => useTasks("b1"), { wrapper });
  const toggle = renderHook(() => useToggleTask(), { wrapper });
  await waitFor(() => expect(tasks.result.current.data?.[0].done).toBe(false));

  act(() => { toggle.result.current.mutate({ id: "t1", boardId: "b1", done: true }); });
  await waitFor(() => expect(tasks.result.current.data?.[0].done).toBe(true));

  release();
  await waitFor(() => expect(toggle.result.current.isError).toBe(true));
  await waitFor(() => expect(tasks.result.current.data?.[0].done).toBe(false));
});
