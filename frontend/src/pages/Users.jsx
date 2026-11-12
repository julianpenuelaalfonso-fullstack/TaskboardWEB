import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Search, LoaderCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { PageHeader, Loading, ErrorBox, Drawer, Field, Avatar, Empty } from "../components/ui";

// RF-003 a RF-008: administración de empleados (solo administradores)
export default function UsersPage() {
  const { user: me } = useAuth();
  const notify = useToast();
  const [users, setUsers] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [u, d] = await Promise.all([api("/users"), api("/departments")]);
      setUsers(u);
      setDepartments(d);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u) => {
    try {
      await api(`/users/${u.id}/active`, { method: "PATCH", body: { active: !u.active } });
      notify(u.active ? `${u.name} ya no podrá iniciar sesión.` : `Cuenta de ${u.name} activada.`);
      load();
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const term = q.trim().toLowerCase();
  const list = (users || []).filter((u) =>
    !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) ||
    (u.department_name || "").toLowerCase().includes(term)
  );

  return (
    <div className="page">
      <PageHeader
        title="Usuarios"
        description={users ? `${users.filter((u) => u.active).length} cuentas activas de ${users.length}.` : "Empleados, roles y acceso a la plataforma."}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} aria-hidden="true" /> Registrar empleado
          </button>
        }
      />
      <div className="filters-bar">
        <div className="search">
          <Search size={17} aria-hidden="true" />
          <label htmlFor="u-q" className="sr-only">Buscar usuarios</label>
          <input id="u-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo o área" />
        </div>
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!users && !error && <Loading />}
      {users && list.length === 0 && <Empty title="Nadie coincide con la búsqueda" />}
      {list.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Empleado</th>
                <th scope="col">Rol</th>
                <th scope="col">Departamento</th>
                <th scope="col">Estado</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className={u.active ? "" : "is-inactive"}>
                  <td>
                    <span className="cell-person">
                      <Avatar name={u.name} size="sm" />
                      <span>{u.name}<small className="cell-sub">{u.email}</small></span>
                    </span>
                  </td>
                  <td>{u.role_name}</td>
                  <td>{u.department_name || <span className="muted">—</span>}</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={u.active} disabled={u.id === me.id}
                        onChange={() => toggleActive(u)} aria-label={`Cuenta de ${u.name} ${u.active ? "activa" : "inactiva"}`} />
                      <span className="switch-track" aria-hidden="true" />
                      <span className="switch-label">{u.active ? "Activa" : "Inactiva"}</span>
                    </label>
                  </td>
                  <td className="cell-actions">
                    <button type="button" className="icon-btn" aria-label={`Editar ${u.name}`} title="Editar" onClick={() => setEditing(u)}>
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <UserForm
          target={editing.id ? editing : null}
          departments={departments}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { notify(msg); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function UserForm({ target, departments, onClose, onSaved }) {
  const { meta, user: me } = useAuth();
  const [form, setForm] = useState({
    name: target?.name ?? "",
    email: target?.email ?? "",
    role_id: target?.role_id ?? "colaborador",
    department_id: target?.department_id ?? "",
    position: target?.position ?? "",
    phone: target?.phone ?? "",
    password: ""
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const roles = meta.roles.filter((r) => r.id !== "superadmin" || me.role_id === "superadmin");

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Escribe el nombre.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = "Escribe un correo válido.";
    if (!target || form.password) {
      if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
        errs.password = "Mínimo 8 caracteres, con letras y números.";
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setServerError("");
    try {
      const body = { ...form, department_id: form.department_id ? Number(form.department_id) : null };
      if (!body.password) delete body.password;
      if (target) await api(`/users/${target.id}`, { method: "PUT", body });
      else await api("/users", { method: "POST", body });
      onSaved(target ? "Datos del empleado actualizados." : `${form.name} ya puede iniciar sesión.`);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      title={target ? "Editar empleado" : "Registrar empleado"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="user-form" className="btn btn-primary" disabled={busy}>
            {busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
            {target ? "Guardar cambios" : "Registrar"}
          </button>
        </>
      }
    >
      <form id="user-form" className="form" onSubmit={submit} noValidate>
        {serverError && <p className="form-error" role="alert">{serverError}</p>}
        {target && (
          <div className="form-person"><Avatar name={target.name} /><span>{target.name}</span></div>
        )}
        <Field label="Nombre completo" htmlFor="u-name" error={errors.name} required>
          <input id="u-name" value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Correo" htmlFor="u-email" error={errors.email} required>
          <input id="u-email" type="email" value={form.email} onChange={set("email")} />
        </Field>
        <div className="form-row">
          <Field label="Rol" htmlFor="u-role">
            <select id="u-role" value={form.role_id} onChange={set("role_id")} disabled={target?.id === me.id}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Departamento" htmlFor="u-dep">
            <select id="u-dep" value={form.department_id} onChange={set("department_id")}>
              <option value="">Sin departamento</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>
        <p className="field-hint role-hint">{meta.roles.find((r) => r.id === form.role_id)?.description}</p>
        <div className="form-row">
          <Field label="Cargo" htmlFor="u-pos">
            <input id="u-pos" value={form.position} onChange={set("position")} />
          </Field>
          <Field label="Teléfono" htmlFor="u-phone">
            <input id="u-phone" type="tel" value={form.phone} onChange={set("phone")} />
          </Field>
        </div>
        <Field label={target ? "Nueva contraseña" : "Contraseña inicial"} htmlFor="u-pass" error={errors.password}
          required={!target} hint={target ? "Déjala vacía para no cambiarla." : "El empleado puede cambiarla desde su perfil."}>
          <input id="u-pass" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
        </Field>
      </form>
    </Drawer>
  );
}
