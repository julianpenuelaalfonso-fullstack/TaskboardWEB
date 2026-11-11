import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "../ui/Skeleton";
import { authClient } from "./authClient";
import { loginUrl } from "./redirect";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const loc = useLocation();
  if (isPending) return <main><Skeleton lines={4} /></main>;
  if (!data) return <Navigate to={loginUrl(loc.pathname + loc.search)} replace />;
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <main><Skeleton lines={4} /></main>;
  return data ? <Navigate to="/app" replace /> : <>{children}</>;
}
