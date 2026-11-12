import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, LoaderCircle, FolderKanban } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { PageHeader, Loading, ErrorBox, Drawer, Field, PeoplePicker, Avatar, Empty } from "../components/ui";

// RF-016 a RF-020: departamentos
export default function Departments() {
  const { permissions } = useAuth();
  const notify = useToast();
  const [deps, setDeps] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [members, setMembers] = useState(null); // { dep, list }
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [d, u] = await Promise.all([api("/departments"), api("/users")]);
      setDeps(d);
      setUsers(u);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const showMembers = async (dep) => {
    try {
      setMembers({ dep, list: await api(`/departments/${dep.id}/members`) });
    } catch (err) {
      notify(err.message, "error");
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Departamentos"
        description="Áreas de la empresa, su líder y sus integrantes."
        actions={permissions.manageDepartments && (
          <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} aria-hidden="true" /> Nuevo departamento
          </button>
        )}
      />
      {error && <ErrorBox message={error} onRetry={load} />}
      {!deps && !error && <Loading />}
      {deps && deps.length === 0 && <Empty title="Aún no hay departamentos" />}
      {deps && deps.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Departamento</th>
                <th scope="col">Líder</th>
                <th scope="col" className="num">Integrantes</th>
                <th scope="col" className="num">Proyectos activos</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {deps.map((d) => (
                <tr key={d.id}>
                  <td>
                    <button type="button" className="table-link" onClick={() => showMembers(d)}>{d.name}</button>
                    {d.description && <small className="cell-sub">{d.description}</small>}
                  </td>
                  <td>{d.leader_name ? <span className="cell-person"><Avatar name={d.leader_name} size="sm" />{d.leader_name}</span> : <span className="muted">Sin líder</span>}</td>
                  <td className="num">{d.member_count}</td>
                  <td className="num">{d.project_count}</td>
                  <td className="cell-actions">
                    <a className="icon-btn" href="#/proyectos" title="Ver proyectos" aria-label={`Ver proyectos de ${d.name}`}>
                      <FolderKanban size={18} aria-hidden="true" />
                    </a>
                    {permissions.manageDepartments && (
                      <button type="button" className="icon-btn" aria-label={`Editar ${d.name}`} title="Editar"
                        onClick={async () => setEditing({ ...d, members: await api(`/departments/${d.id}/members`) })}>
                        <Pencil size={18} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {members && (
        <Drawer title={members.dep.name} onClose={() => setMembers(null)}>
          <p className="muted">{members.dep.description}</p>
          <h4>Integrantes <span className="count">{members.list.length}</span></h4>
          {members.list.length === 0 && <p className="muted">Sin integrantes.</p>}
          <ul className="people people-lg">
            {members.list.map((m) => (
              <li key={m.id} className={m.active ? "" : "is-inactive"}>
                <Avatar name={m.name} size="sm" />
                <span>{m.name}<small>{m.position || m.role_name}{m.id === members.dep.leader_id ? " · Líder del departamento" : ""}{!m.active ? " · Inactivo" : ""}</small></span>
              </li>
            ))}
          </ul>
        </Drawer>
      )}

      {editing && (
        <DepartmentForm
          dep={editing.id ? editing : null}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { notify(msg); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function DepartmentForm({ dep, users, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: dep?.name ?? "",
    description: dep?.description ?? "",
    leader_id: dep?.leader_id ?? "",
    member_ids: dep?.members?.map((m) => m.id) ?? []
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = users.filter((u) => u.active !== false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Escribe el nombre.";
    if (!form.leader_id) errs.leader_id = "Todo departamento necesita un líder responsable.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setServerError("");
    try {
      const body = { name: form.name, description: form.description, leader_id: Number(form.leader_id) };
      const saved = dep
        ? await api(`/departments/${dep.id}`, { method: "PUT", body })
        : await api("/departments", { method: "POST", body });
      await api(`/departments/${saved.id}/members`, { method: "PUT", body: { user_ids: form.member_ids } });
      onSaved(dep ? "Departamento actualizado." : `Departamento «${form.name}» creado.`);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      title={dep ? "Editar departamento" : "Nuevo departamento"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="dep-form" className="btn btn-primary" disabled={busy}>
            {busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
            {dep ? "Guardar cambios" : "Crear departamento"}
          </button>
        </>
      }
    >
      <form id="dep-form" className="form" onSubmit={submit} noValidate>
        {serverError && <p className="form-error" role="alert">{serverError}</p>}
        <Field label="Nombre" htmlFor="d-name" error={errors.name} required>
          <input id="d-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Descripción" htmlFor="d-desc">
          <textarea id="d-desc" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>
        <Field label="Líder responsable" htmlFor="d-leader" error={errors.leader_id} required>
          <select id="d-leader" value={form.leader_id} onChange={(e) => setForm((f) => ({ ...f, leader_id: e.target.value }))}>
            <option value="">Selecciona una persona</option>
            {active.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Integrantes" htmlFor="d-members" hint="Al guardar, las personas marcadas pasan a este departamento.">
          <PeoplePicker id="d-members" users={active} value={form.member_ids}
            onChange={(ids) => setForm((f) => ({ ...f, member_ids: ids }))} />
        </Field>
      </form>
    </Drawer>
  );
}
