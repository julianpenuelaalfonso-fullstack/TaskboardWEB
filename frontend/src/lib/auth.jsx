import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { user, permissions }
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [meta, setMeta] = useState({ statuses: [], priorities: [], roles: [] });

  const loadMeta = useCallback(async () => {
    setMeta(await api("/meta"));
  }, []);

  // Al recargar, se recupera la sesión guardada
  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me")
      .then(async (data) => {
        setSession(data);
        await loadMeta();
      })
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, [loadMeta]);

  // Si el servidor responde 401, se cierra la sesión
  useEffect(() => {
    const onLogout = () => setSession(null);
    window.addEventListener("taskboard:logout", onLogout);
    return () => window.removeEventListener("taskboard:logout", onLogout);
  }, []);

  const login = async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(data.token);
    await loadMeta();
    setSession({ user: data.user, permissions: data.permissions });
  };

  // RF-002: cerrar sesión
  const logout = () => {
    setToken(null);
    setSession(null);
    window.location.hash = "";
  };

  const updateUser = (user) => setSession((s) => ({ ...s, user }));

  return (
    <AuthContext.Provider value={{ ...session, meta, checking, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
