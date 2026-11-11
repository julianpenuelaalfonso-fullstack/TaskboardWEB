// Solo rutas internas de la app: "/app" exacto o "/app/..." (y "?"/"#"); nada de "//host" ni "/apple".
export function safeNext(next: string | null): string {
  return next && /^\/app(?:[/?#]|$)/.test(next) && !next.includes("\\") && !next.split(/[?#]/)[0].split("/").includes("..") ? next : "/app";
}

export const loginUrl = (from: string) => `/login?next=${encodeURIComponent(from)}`;

// Las peticiones a /auth/* devuelven 401 en un login fallido: ahí el formulario muestra el error.
// Antes de ir a /login se refresca la sesión en caché; si no, PublicOnly la ve viva y rebota a /app.
export const createUnauthorizedHandler =
  (navigate: (to: string) => void, current: () => string, clearSession: () => Promise<unknown>) =>
  async (path: string) => {
    if (path.startsWith("/auth/")) return;
    const from = current();
    await clearSession().catch(() => undefined);
    navigate(loginUrl(from));
  };
