import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { PageHeader, Field, Avatar } from "../components/ui";

// RF-009: perfil personal
export default function Profile() {
  const { user, updateUser } = useAuth();
  const notify = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || "", position: user.position || "" });
  const [pass, setPass] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState("");
  const [errors, setErrors] = useState({});

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErrors({ name: "El nombre es obligatorio." });
    setErrors({});
    setBusy("profile");
    try {
      const { user: updated } = await api("/auth/me", { method: "PUT", body: form });
      updateUser(updated);
      notify("Perfil actualizado.");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy("");
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pass.newPassword !== pass.confirm) return setErrors({ confirm: "Las contraseñas no coinciden." });
    setErrors({});
    setBusy("password");
    try {
      await api("/auth/me/password", { method: "PUT", body: pass });
      setPass({ currentPassword: "", newPassword: "", confirm: "" });
      notify("Contraseña actualizada.");
    } catch (err) {
      setErrors({ password: err.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="page page-narrow">
      <PageHeader title="Mi perfil" />
      <div className="profile-card">
        <Avatar name={user.name} size="lg" />
        <div>
          <p className="profile-name">{user.name}</p>
          <p className="muted">{user.email}</p>
          <p className="muted">{user.role_name}{user.department_name ? ` · ${user.department_name}` : ""}</p>
        </div>
      </div>

      <form className="form panel" onSubmit={saveProfile} noValidate>
        <h2>Datos personales</h2>
        <Field label="Nombre completo" htmlFor="pr-name" error={errors.name} required>
          <input id="pr-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <div className="form-row">
          <Field label="Cargo" htmlFor="pr-pos">
            <input id="pr-pos" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
          </Field>
          <Field label="Teléfono" htmlFor="pr-phone">
            <input id="pr-phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
        </div>
        <p className="field-hint">El correo, el rol y el departamento los cambia un administrador.</p>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy === "profile"}>
            {busy === "profile" && <LoaderCircle size={18} className="spin" aria-hidden="true" />} Guardar datos
          </button>
        </div>
      </form>

      <form className="form panel" onSubmit={savePassword} noValidate>
        <h2>Cambiar contraseña</h2>
        {errors.password && <p className="form-error" role="alert">{errors.password}</p>}
        <Field label="Contraseña actual" htmlFor="pr-cur">
          <input id="pr-cur" type="password" autoComplete="current-password" value={pass.currentPassword}
            onChange={(e) => setPass((p) => ({ ...p, currentPassword: e.target.value }))} />
        </Field>
        <div className="form-row">
          <Field label="Contraseña nueva" htmlFor="pr-new" hint="Mínimo 8 caracteres, con letras y números.">
            <input id="pr-new" type="password" autoComplete="new-password" value={pass.newPassword}
              onChange={(e) => setPass((p) => ({ ...p, newPassword: e.target.value }))} />
          </Field>
          <Field label="Repítela" htmlFor="pr-conf" error={errors.confirm}>
            <input id="pr-conf" type="password" autoComplete="new-password" value={pass.confirm}
              onChange={(e) => setPass((p) => ({ ...p, confirm: e.target.value }))} />
          </Field>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy === "password"}>
            {busy === "password" && <LoaderCircle size={18} className="spin" aria-hidden="true" />} Cambiar contraseña
          </button>
        </div>
      </form>
    </div>
  );
}
