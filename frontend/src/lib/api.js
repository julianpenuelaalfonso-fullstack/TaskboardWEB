const API = import.meta.env.VITE_API_URL;
const TOKEN_KEY = "taskboard_token";

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* almacenamiento no disponible */ }
};

// Petición a la API con el token de sesión. Lanza Error con el mensaje del servidor.
export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${API}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error("No pudimos conectar con el servidor. Si es la primera visita, puede estar despertando: intenta de nuevo en unos segundos.");
  }
  if (res.status === 401 && getToken()) {
    setToken(null);
    window.dispatchEvent(new Event("taskboard:logout"));
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}
