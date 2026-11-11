import { createBrowserRouter, Navigate } from "react-router-dom";
import { authRoutes } from "./auth/routes";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./layout/AppShell";
import { EmptyState } from "./ui/EmptyState";

export const router = createBrowserRouter([
  ...authRoutes,
  {
    path: "/app",
    element: <RequireAuth><AppShell /></RequireAuth>,
    // La tarea 11 añade b/:boardId, w/:workspaceId y archivados.
    children: [{ index: true, element: <main><EmptyState title="Elige un tablero o crea uno nuevo." /></main> }]
  },
  { path: "*", element: <Navigate to="/app" replace /> }
]);
