import { createBrowserRouter, Navigate } from "react-router-dom";
import { authRoutes } from "./auth/routes";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./layout/AppShell";
import { AppIndex } from "./boards/AppIndex";
import { ArchivedPage } from "./boards/ArchivedPage";
import { BoardPage } from "./boards/BoardPage";
import { WorkspacePage } from "./boards/WorkspacePage";

export const router = createBrowserRouter([
  ...authRoutes,
  {
    path: "/app",
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <AppIndex /> },
      { path: "b/:boardId", element: <BoardPage /> },
      { path: "w/:workspaceId", element: <WorkspacePage /> },
      { path: "archivados", element: <ArchivedPage /> }
    ]
  },
  { path: "*", element: <Navigate to="/app" replace /> }
]);
