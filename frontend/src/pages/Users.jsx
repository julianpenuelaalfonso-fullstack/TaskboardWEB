import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Search, LoaderCircle, Send, Copy, MailCheck, MailWarning } from "lucide-react";
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

  const [inviteResult, setInviteResult] = useState(null); // { name, email, sent, link, message }
  const [resending, setResending] = useState(null);

  // Muestra el resultado de una invitación: aviso si salió el correo, o el enlace para copiar si no
  const handleInvite = (person, invite) => {
    if (!invite) return;
    if (invite.sent) notify(invite.message);
    else setInviteResult({ ...invite, name: person.name, email: person.email });
  };

  const resend = async (u) => {
    setResending(u.id);
    try {
      handleInvite(u, await api(`/users/${u.id}/invite`, { method: "POST" }));
      load();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setResending(null);
    }
  };

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
                    {u.password_set === false && u.active && (
                      <span className="invite-pending">
                        <span className="chip chip-pending">Invitación pendiente</span>
                        <button type="button" className="link-btn" onClick={() => resend(u)} disabled={resending === u.id}>
                          {resending === u.id ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                          Reenviar
                        </button>
                      </span>
                    )}
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
          onSaved={(msg, created) => {
            setEditing(null);
            load();
            if (created?.invite) handleInvite(created, created.invite);
            else notify(msg);
          }}
        />
      )}
      {inviteResult && <InviteLinkDrawer result={inviteResult} onClose={() => setInviteResult(null)} />}
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
    password: "",
    send_invite: true
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
    const needsPassword = target ? Boolean(form.password) : !form.send_invite;
    if (needsPassword) {
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
      if (!body.password || (!target && form.send_invite)) delete body.password;
      if (target) {
        delete body.send_invite;
        await api(`/users/${target.id}`, { method: "PUT", body });
        onSaved("Datos del empleado actualizados.");
      } else {
        const created = await api("/users", { method: "POST", body });
        onSaved(`${form.name} ya puede iniciar sesión.`, created);
      }
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
            {target ? "Guardar cambios" : form.send_invite ? "Registrar e invitar" : "Registrar"}
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
        {!target && (
          <label className="check-row">
            <input type="checkbox" checked={form.send_invite}
              onChange={(e) => setForm((f) => ({ ...f, send_invite: e.target.checked }))} />
            <span>
              Enviar invitación por correo
              <small>La persona recibe un enlace para crear su propia contraseña (vence en 72 horas). Recomendado: así nadie más conoce su contraseña.</small>
            </span>
          </label>
        )}
        {(target || !form.send_invite) && (
          <Field label={target ? "Nueva contraseña" : "Contraseña inicial"} htmlFor="u-pass" error={errors.password}
            required={!target} hint={target ? "Déjala vacía para no cambiarla." : "Compártela con la persona; puede cambiarla desde su perfil."}>
            <input id="u-pass" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
          </Field>
        )}
      </form>
    </Drawer>
  );
}

// Cuando el correo no sale (Zoho no configurado o con error), el administrador copia el enlace y lo envía por otro medio
function InviteLinkDrawer({ result, onClose }) {
  const notify = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.link);
      notify("Enlace copiado.");
    } catch {
      notify("No se pudo copiar. Selecciona el enlace y cópialo manualmente.", "error");
    }
  };
  return (
    <Drawer title="Invitación creada" onClose={onClose}
      footer={<button type="button" className="btn btn-primary" onClick={onClose}>Listo</button>}>
      <div className="invite-result">
        <p className="notice notice-dev"><MailWarning size={18} aria-hidden="true" /> {result.message}</p>
        <p>Envíale este enlace a <strong>{result.name}</strong> ({result.email}). Sirve una sola vez y vence en 72 horas.</p>
        <div className="copy-row">
          <label htmlFor="invite-link" className="sr-only">Enlace de invitación</label>
          <input id="invite-link" value={result.link} readOnly onFocus={(e) => e.target.select()} />
          <button type="button" className="btn btn-secondary" onClick={copy}><Copy size={16} aria-hidden="true" /> Copiar</button>
        </div>
        <p className="muted"><MailCheck size={16} aria-hidden="true" /> Cuando el correo esté configurado en el servidor, la invitación llegará sola a su bandeja.</p>
      </div>
    </Drawer>
  );
}
