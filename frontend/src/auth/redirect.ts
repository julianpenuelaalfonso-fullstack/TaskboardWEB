// Solo rutas internas de la app: "/app" exacto o "/app/..." (y "?"/"#"); nada de "//host" ni "/apple".
export function safeNext(next: string | null): string {
  return next && /^\/app(?:[/?#]|$)/.test(next) && !next.includes("\\") ? next : "/app";
}

export const loginUrl = (from: string) => `/login?next=${encodeURIComponent(from)}`;

// Las peticiones a /auth/* devuelven 401 en un login fallido: ahí el formulario muestra el error.
export const createUnauthorizedHandler =
  (navigate: (to: string) => void, current: () => string) => (path: string) => {
    if (!path.startsWith("/auth/")) navigate(loginUrl(current()));
  };
