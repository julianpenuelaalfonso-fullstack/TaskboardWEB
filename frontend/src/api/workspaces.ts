import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, send } from "./client";
import type { Workspace } from "./types";

export const useWorkspaces = () =>
  useQuery({ queryKey: ["workspaces"], queryFn: () => apiFetch<Workspace[]>("/workspaces") });

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch<Workspace>("/workspaces", send("POST", { name })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] })
  });
}

export function useRenameWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<Workspace>(`/workspaces/${id}`, send("PATCH", { name })),
    // El nombre del workspace también viaja en los tableros archivados y en GET /boards/:id.
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["workspaces"] }),
      qc.invalidateQueries({ queryKey: ["board"] }),
      qc.invalidateQueries({ queryKey: ["boards", "archived"] })
    ])
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/workspaces/${id}`, send("DELETE")),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: ["boards", id] });
      return Promise.all([
        qc.invalidateQueries({ queryKey: ["workspaces"] }),
        qc.invalidateQueries({ queryKey: ["boards", "archived"] })
      ]);
    }
  });
}
