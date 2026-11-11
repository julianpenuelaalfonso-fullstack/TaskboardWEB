import { createBrowserRouter, Navigate } from "react-router-dom";
import { authRoutes } from "./auth/routes";
import { RequireAuth } from "./auth/RequireAuth";

export const router = createBrowserRouter([
  ...authRoutes,
  // Marcador temporal: la tarea 10 monta aquí el shell y los tableros.
  { path: "/app/*", element: <RequireAuth><div>App</div></RequireAuth> },
  { path: "*", element: <Navigate to="/app" replace /> }
]);
