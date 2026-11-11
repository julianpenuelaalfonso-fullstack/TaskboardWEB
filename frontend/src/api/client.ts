import { QueryClient } from "@tanstack/react-query";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let onUnauthorized: (path: string) => void = () => {};
export const setUnauthorizedHandler = (fn: (path: string) => void) => { onUnauthorized = fn; };

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      credentials: "same-origin",
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers }
    });
  } catch {
    throw new ApiError(0, "network", "No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const e = body?.error;
    if (res.status === 401) onUnauthorized(path);
    throw new ApiError(res.status, e?.code ?? "internal", e?.message ?? `Error ${res.status}`, e?.fields);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => count < 2 && err instanceof ApiError && (err.status === 0 || err.status >= 500)
    }
  }
});
