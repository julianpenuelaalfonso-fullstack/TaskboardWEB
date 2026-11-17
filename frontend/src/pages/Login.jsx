import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

const DEMO = [
  ["Administrador", "admin@innova.com"],
  ["Gerente", "gerente@innova.com"],
  ["Líder de equipo", "lider@innova.com"],
  ["Colaborador", "colaborador@innova.com"],
  ["Invitado", "invitado@innova.com"]
];

export default function Login() {
  const { login, startSession } = useAuth();
  const query = new URLSearchParams(window.location.search);
  const resetToken = query.get("invite") || query.get("reset");
  const [mode, setMode] = useState(query.get("invite") ? "invite" : resetToken ? "reset" : "login");
  const [linkInfo, setLinkInfo] = useState(null); // { name, email, kind } o { invalid: true }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devLink, setDevLink] = useState("");

  // Con un enlace de invitación o recuperación, se consulta a quién pertenece para saludar por nombre
  useEffect(() => {
    if (!resetToken) return;
    api(`/auth/link/${encodeURIComponent(resetToken)}`)
      .then(setLinkInfo)
      .catch(() => setLinkInfo({ invalid: true }));
  }, [resetToken]);

  const clearLinkFromUrl = () => window.history.replaceState(null, "", window.location.pathname + window.location.hash);

  const go = (next) => {
    setMode(next);
    setError("");
    setInfo("");
    setDevLink("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "login") {
        if (!email.trim() || !password) throw new Error("Escribe tu correo y tu contraseña.");
        await login(email.trim(), password);
      } else if (mode === "forgot") {
        if (!email.trim()) throw new Error("Escribe el correo de tu cuenta.");
        const r = await api("/auth/forgot", { method: "POST", body: { email: email.trim() } });
        setInfo(r.message);
        if (r.devResetLink) setDevLink(r.devResetLink);
      } else {
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
          throw new Error("La contraseña debe tener al menos 8 caracteres, con letras y números.");
        }
        if (password !== confirm) throw new Error("Las contraseñas no coinciden.");
        const r = await api("/auth/reset", { method: "POST", body: { token: resetToken, password } });
        clearLinkFromUrl();
        // La persona queda con la sesión iniciada
        await startSession(r);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const settingPassword = mode === "reset" || mode === "invite";
  const firstName = linkInfo?.name ? linkInfo.name.split(" ")[0] : "";
  const titles = {
    login: ["Inicia sesión", "Usa el correo y la contraseña de tu cuenta."],
    forgot: ["Recupera tu contraseña", "Te enviaremos un enlace para crear una nueva."],
    reset: ["Crea una contraseña nueva", "Mínimo 8 caracteres, con letras y números."],
    invite: [firstName ? `Hola, ${firstName}` : "Activa tu cuenta", "Crea tu contraseña para entrar a TaskBoard. Mínimo 8 caracteres, con letras y números."]
  };

  // Enlace vencido, usado o de una cuenta desactivada
  if (settingPassword && linkInfo?.invalid) {
    return (
      <div className="login">
        <section className="login-brand">
          <div className="login-brand-inner">
            <p className="logo">Task<span>Board</span></p>
            <h1 className="login-claim">Proyectos, responsables y fechas de toda la empresa en un solo tablero.</h1>
          </div>
        </section>
        <section className="login-panel">
          <div className="login-form">
            <h2>Este enlace ya no sirve</h2>
            <p className="muted">
              {mode === "invite"
                ? "La invitación venció, ya se usó o fue reemplazada por una nueva. Pide al administrador que te la reenvíe."
                : "El enlace venció o ya se usó. Solicita uno nuevo."}
            </p>
            {mode === "reset" && (
              <button type="button" className="btn btn-primary btn-block" onClick={() => { clearLinkFromUrl(); go("forgot"); }}>
                Solicitar un enlace nuevo
              </button>
            )}
            <button type="button" className="link-btn" onClick={() => { clearLinkFromUrl(); go("login"); }}>Ir a iniciar sesión</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="login">
      <section className="login-brand">
        <div className="login-brand-inner">
          <p className="logo">Task<span>Board</span></p>
          <h1 className="login-claim">Proyectos, responsables y fechas de toda la empresa en un solo tablero.</h1>
          <p className="login-company">INNOVA SOLUCIONES S.A.S.</p>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={submit} noValidate>
          <h2>{titles[mode][0]}</h2>
          <p className="muted">{titles[mode][1]}</p>

          {info && <p className="notice" role="status">{info}</p>}
          {devLink && (
            <p className="notice notice-dev">
              Modo desarrollo (sin correo): <a href={devLink}>abrir enlace de recuperación</a>
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}

          {settingPassword && linkInfo?.email && (
            <div className="field">
              <label htmlFor="account">Cuenta</label>
              <input id="account" type="email" value={linkInfo.email} readOnly autoComplete="username" />
            </div>
          )}
          {!settingPassword && (
            <div className="field">
              <label htmlFor="email">Correo</label>
              <input id="email" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.com" />
            </div>
          )}
          {mode !== "forgot" && (
            <div className="field">
              <label htmlFor="password">{settingPassword ? (mode === "invite" ? "Crea tu contraseña" : "Contraseña nueva") : "Contraseña"}</label>
              <input id="password" type="password" value={password}
                autoComplete={settingPassword ? "new-password" : "current-password"}
                onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          {settingPassword && (
            <div className="field">
              <label htmlFor="confirm">Repite la contraseña</label>
              <input id="confirm" type="password" autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} />
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
            {mode === "login" ? "Ingresar" : mode === "forgot" ? "Enviar enlace" : mode === "invite" ? "Activar mi cuenta" : "Guardar contraseña"}
          </button>

          {mode === "login" ? (
            <button type="button" className="link-btn" onClick={() => go("forgot")}>¿Olvidaste tu contraseña?</button>
          ) : (
            <button type="button" className="link-btn" onClick={() => { if (settingPassword) clearLinkFromUrl(); go("login"); }}>
              {mode === "invite" ? "Ya tengo contraseña" : "Volver a iniciar sesión"}
            </button>
          )}

          {mode === "login" && (
            <details className="demo">
              <summary>Cuentas de demostración</summary>
              <p className="muted">Contraseña para todas: <code>Innova2026*</code></p>
              <ul>
                {DEMO.map(([role, mail]) => (
                  <li key={mail}>
                    <button type="button" className="link-btn" onClick={() => { setEmail(mail); setPassword("Innova2026*"); }}>
                      {role}
                    </button>
                    <span>{mail}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </form>
      </section>
    </div>
  );
}
