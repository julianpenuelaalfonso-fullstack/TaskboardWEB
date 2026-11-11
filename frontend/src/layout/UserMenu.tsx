import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { GENERIC_ERROR } from "../auth/useAccountForm";
import { validatePassword } from "../auth/validation";
import { authClient } from "../auth/authClient";
import { getTheme, setTheme, type Theme } from "../theme/theme";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { useToast } from "../ui/Toast";

function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const current = String(f.get("current") ?? "");
    const next = String(f.get("next") ?? "");
    const errs = { current: current ? "" : "Escribe tu contraseña actual.", next: validatePassword(next) ?? "" };
    setErrors(errs);
    setFormError(null);
    if (errs.current || errs.next) return;
    setBusy(true);
    try {
      const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next });
      if (!error) { onClose(); toast.show("Contraseña actualizada"); return; }
      setFormError(error.code === "INVALID_PASSWORD" ? "La contraseña actual no es correcta." : GENERIC_ERROR);
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="name-form">
      {formError && <div className="alert" role="alert"><p>{formError}</p></div>}
      <Field label="Contraseña actual" error={errors.current}><input name="current" type="password" autoComplete="current-password" /></Field>
      <Field label="Contraseña nueva" error={errors.next}><input name="next" type="password" autoComplete="new-password" /></Field>
      <div className="dialog-actions">
        <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="primary" disabled={busy}>Guardar contraseña</button>
      </div>
    </form>
  );
}

export function UserMenu() {
  const { data } = authClient.useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [pwOpen, setPwOpen] = useState(false);

  const signOut = async () => {
    await authClient.signOut();
    qc.clear(); // la caché pertenece a la cuenta que se va
    navigate("/login", { replace: true });
  };

  return (
    <div className="user-menu">
      <details>
        <summary>{data?.user.name ?? "Cuenta"}</summary>
        <div className="user-menu-panel">
          <label>
            Tema
            <select value={theme} onChange={(e) => { const t = e.target.value as Theme; setTheme(t); setThemeState(t); }}>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
              <option value="system">Automático</option>
            </select>
          </label>
          <button type="button" onClick={() => setPwOpen(true)}>Cambiar contraseña</button>
          <button type="button" onClick={() => void signOut()}>Cerrar sesión</button>
        </div>
      </details>
      <Dialog open={pwOpen} onClose={() => setPwOpen(false)} title="Cambiar contraseña">
        <ChangePasswordForm onClose={() => setPwOpen(false)} />
      </Dialog>
    </div>
  );
}
