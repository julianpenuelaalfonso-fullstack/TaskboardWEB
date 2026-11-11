export type BoardColor = "cobalt" | "teal" | "green" | "amber" | "coral" | "violet";

export interface Workspace { id: string; name: string; isPersonal: boolean; role: string }

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  color: BoardColor;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardWithWorkspace extends Board { workspaceName: string }

export interface Task { id: string; boardId: string; title: string; done: boolean; createdAt: string }
