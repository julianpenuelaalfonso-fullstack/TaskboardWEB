import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, send } from "./client";
import type { Task } from "./types";

export const useTasks = (boardId: string) =>
  useQuery({ queryKey: ["tasks", boardId], queryFn: () => apiFetch<Task[]>(`/boards/${boardId}/tasks`) });

export function useCreateTask(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => apiFetch<Task>(`/boards/${boardId}/tasks`, send("POST", { title })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", boardId] })
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; boardId: string; done: boolean }) =>
      apiFetch<Task>(`/tasks/${id}`, send("PATCH", { done })),
    onMutate: async ({ id, boardId, done }) => {
      const key = ["tasks", boardId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Task[]>(key);
      qc.setQueryData<Task[]>(key, (old) => old?.map((t) => (t.id === id ? { ...t, done } : t)));
      return { previous };
    },
    onError: (_e, { boardId }, ctx) => qc.setQueryData(["tasks", boardId], ctx?.previous),
    onSettled: (_d, _e, { boardId }) => qc.invalidateQueries({ queryKey: ["tasks", boardId] })
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; boardId: string }) => apiFetch<void>(`/tasks/${id}`, send("DELETE")),
    onSuccess: (_d, { boardId }) => qc.invalidateQueries({ queryKey: ["tasks", boardId] })
  });
}
