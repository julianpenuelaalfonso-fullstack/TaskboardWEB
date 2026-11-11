import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, send } from "./client";
import type { Board, BoardColor, BoardWithWorkspace } from "./types";

export const useBoards = (workspaceId: string, archived = false) =>
  useQuery({
    queryKey: ["boards", workspaceId, archived],
    queryFn: () => apiFetch<Board[]>(`/workspaces/${workspaceId}/boards?archived=${archived}`)
  });

export const useArchivedBoards = () =>
  useQuery({ queryKey: ["boards", "archived"], queryFn: () => apiFetch<BoardWithWorkspace[]>("/boards/archived") });

export const useBoard = (boardId: string) =>
  useQuery({ queryKey: ["board", boardId], queryFn: () => apiFetch<BoardWithWorkspace>(`/boards/${boardId}`) });

export function useCreateBoard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: BoardColor }) =>
      apiFetch<Board>(`/workspaces/${workspaceId}/boards`, send("POST", input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boards", workspaceId] })
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; color?: BoardColor; archived?: boolean }) =>
      apiFetch<Board>(`/boards/${id}`, send("PATCH", patch)),
    // Prefijo ["boards"] cubre ["boards", ws, *] y ["boards","archived"].
    onSuccess: (b) => Promise.all([
      qc.invalidateQueries({ queryKey: ["board", b.id] }),
      qc.invalidateQueries({ queryKey: ["boards"] })
    ])
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/boards/${id}`, send("DELETE")),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: ["board", id] });
      qc.removeQueries({ queryKey: ["tasks", id] });
      return qc.invalidateQueries({ queryKey: ["boards"] });
    }
  });
}
