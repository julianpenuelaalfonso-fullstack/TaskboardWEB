import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Archive, KanbanSquare, CalendarRange, LoaderCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { formatDate, PRIORITY_LABEL } from "../lib/format";
import { PageHeader, Empty, Loading, ErrorBox, Drawer, Field, PeoplePicker, Avatar } from "../components/ui";

// RF-021 a RF-029: gestión de proyectos
export default function Projects() {
  const { permissions } = useAuth();
  const notify = useToast();
  const [projects, setProjects] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [department, setDepartment] = useState("");
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setError("");
    const qs = new URLSearchParams();
    if (department) qs.set("department_id", department);
    if (archived) qs.set("archived", "true");
    try {
      setProjects(await api(`/projects?${qs}`));
    } catch (err) {
      setError(err.message);
    }
  }, [department, archived]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([api("/departments"), api("/users")]).then(([d, u]) => { setDepartments(d); setUsers(u); });
  }, []);

  const toggleArchive = async (p) => {
    try {
      await api(`/projects/${p.id}/archive`, { method: "PATCH", body: { archived: !p.archived } });
      notify(p.archived ? `«${p.name}» restaurado.` : `«${p.name}» archivado. Ya no recibirá tareas nuevas.`);
      load();
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const openDetail = async (p) => {
    try {
      setDetail(await api(`/projects/${p.id}`));
    } catch (err) {
      notify(err.message, "error");
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Proyectos"
        description="Avance, responsables y fechas clave de cada proyecto."
        actions={permissions.createProject && (
          <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} aria-hidden="true" /> Nuevo proyecto
          </button>
        )}
      />

      <div className="filters-bar">
        <label className="sr-only" htmlFor="p-dep">Departamento</label>
        <select id="p-dep" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">Todos los departamentos</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="segmented" role="group" aria-label="Mostrar proyectos">
          <button type="button" aria-pressed={!archived} onClick={() => setArchived(false)}>Activos</button>
          <button type="button" aria-pressed={archived} onClick={() => setArchived(true)}>Archivados</button>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!projects && !error && <Loading />}
      {projects && projects.length === 0 && (
        <Empty title={archived ? "No hay proyectos archivados" : "No hay proyectos activos"}>
          {permissions.createProject && !archived ? "Crea el primero con «Nuevo proyecto»." : "Cuando te agreguen a un proyecto aparecerá aquí."}
        </Empty>
      )}

      {projects && projects.length > 0 && (
        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.id} className="project-row">
              <div className="project-main">
                <button type="button" className="project-name" onClick={() => openDetail(p)}>{p.name}</button>
                <p className="project-sub">
                  {p.department_name || "Sin departamento"} · Líder: {p.leader_name}
                </p>
                <p className="project-dates">
                  <CalendarRange size={15} aria-hidden="true" />
                  {formatDate(p.start_date)} – {formatDate(p.end_date, { day: "numeric", month: "short", year: "numeric" })}
                  <span className={`prio p-${p.priority_id}`}>{PRIORITY_LABEL[p.priority_id]}</span>
                  {p.overdue_count > 0 && <span className="chip chip-overdue">{p.overdue_count} vencidas</span>}
                </p>
              </div>
              <div className="project-progress">
                <div className="progress-label">
                  <span>{p.done_count} de {p.task_count} tareas</span>
                  <strong>{p.progress}%</strong>
                </div>
                <div className="bar" role="progressbar" aria-label={`Avance de ${p.name}`}
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.progress}>
                  <span style={{ width: `${p.progress}%` }} />
                </div>
              </div>
              <div className="row-actions">
                <a className="btn btn-secondary btn-sm" href={`#/tablero?proyecto=${p.id}`}>
                  <KanbanSquare size={16} aria-hidden="true" /> Tablero
                </a>
                {p.can_manage && (
                  <>
                    <button type="button" className="icon-btn" aria-label={`Editar ${p.name}`} title="Editar"
                      onClick={async () => setEditing(await api(`/projects/${p.id}`))}>
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`${p.archived ? "Restaurar" : "Archivar"} ${p.name}`}
                      title={p.archived ? "Restaurar" : "Archivar"} onClick={() => toggleArchive(p)}>
                      <Archive size={18} aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProjectForm
          project={editing.id ? editing : null}
          departments={departments}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { notify(msg); setEditing(null); load(); }}
        />
      )}

      {detail && (
        <Drawer title={detail.name} onClose={() => setDetail(null)}>
          <div className="task-detail">
            <div className="chips">
              <span className={`chip prio p-${detail.priority_id}`}>Prioridad {PRIORITY_LABEL[detail.priority_id].toLowerCase()}</span>
              {detail.requires_approval && <span className="chip">Requiere aprobación del líder</span>}
              {detail.archived && <span className="chip">Archivado</span>}
            </div>
            <dl className="facts">
              <div><dt>Departamento</dt><dd>{detail.department_name || "—"}</dd></div>
              <div><dt>Líder</dt><dd>{detail.leader_name}</dd></div>
              <div><dt>Inicio</dt><dd>{formatDate(detail.start_date, { day: "numeric", month: "long", year: "numeric" })}</dd></div>
              <div><dt>Finalización</dt><dd>{formatDate(detail.end_date, { day: "numeric", month: "long", year: "numeric" })}</dd></div>
              <div><dt>Avance</dt><dd>{detail.progress}% ({detail.done_count} de {detail.task_count} tareas)</dd></div>
            </dl>
            <section><h4>Descripción</h4><p className="prose">{detail.description || "Sin descripción."}</p></section>
            <section><h4>Objetivos</h4><p className="prose">{detail.objectives || "Sin objetivos registrados."}</p></section>
            <section>
              <h4>Participantes <span className="count">{detail.members.length}</span></h4>
              <ul className="people">
                {detail.members.map((m) => (
                  <li key={m.id}><Avatar name={m.name} size="sm" /> {m.name}<small>{m.position}</small></li>
                ))}
              </ul>
            </section>
            <a className="btn btn-primary" href={`#/tablero?proyecto=${detail.id}`}>
              <KanbanSquare size={18} aria-hidden="true" /> Ver tareas del proyecto
            </a>
          </div>
        </Drawer>
      )}
    </div>
  );
}

function ProjectForm({ project, departments, users, onClose, onSaved }) {
  const { user, meta, permissions } = useAuth();
  const [form, setForm] = useState(() => ({
    name: project?.name ?? "",
    description: project?.description ?? "",
    objectives: project?.objectives ?? "",
    department_id: project?.department_id ?? user.department_id ?? "",
    leader_id: project?.leader_id ?? user.id,
    priority_id: project?.priority_id ?? "media",
    start_date: project?.start_date ?? "",
    end_date: project?.end_date ?? "",
    requires_approval: project?.requires_approval ?? true,
    member_ids: project?.members?.map((m) => m.id) ?? []
  }));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const leaders = users.filter((u) => ["lider", "admin", "superadmin"].includes(u.role_id) && u.active !== false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Escribe el nombre del proyecto.";
    if (form.start_date && form.end_date && form.end_date < form.start_date) errs.end_date = "No puede ser anterior al inicio.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setServerError("");
    try {
      const body = { ...form, leader_id: Number(form.leader_id), department_id: form.department_id ? Number(form.department_id) : null };
      if (project) await api(`/projects/${project.id}`, { method: "PUT", body });
      else await api("/projects", { method: "POST", body });
      onSaved(project ? "Proyecto actualizado." : `Proyecto «${form.name}» creado.`);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      title={project ? "Editar proyecto" : "Nuevo proyecto"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="project-form" className="btn btn-primary" disabled={busy}>
            {busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
            {project ? "Guardar cambios" : "Crear proyecto"}
          </button>
        </>
      }
    >
      <form id="project-form" className="form" onSubmit={submit} noValidate>
        {serverError && <p className="form-error" role="alert">{serverError}</p>}
        <Field label="Nombre" htmlFor="p-name" error={errors.name} required>
          <input id="p-name" value={form.name} onChange={set("name")} maxLength={150} />
        </Field>
        <Field label="Descripción" htmlFor="p-desc">
          <textarea id="p-desc" rows={3} value={form.description} onChange={set("description")} />
        </Field>
        <Field label="Objetivos" htmlFor="p-obj">
          <textarea id="p-obj" rows={3} value={form.objectives} onChange={set("objectives")} />
        </Field>
        <div className="form-row">
          <Field label="Departamento" htmlFor="p-dep2">
            <select id="p-dep2" value={form.department_id} onChange={set("department_id")}>
              <option value="">Sin departamento</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Prioridad" htmlFor="p-prio">
            <select id="p-prio" value={form.priority_id} onChange={set("priority_id")}>
              {meta.priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Líder responsable" htmlFor="p-leader"
          hint={permissions.manageUsers ? undefined : "Tú serás el líder de los proyectos que crees."}>
          <select id="p-leader" value={form.leader_id} onChange={set("leader_id")} disabled={!permissions.manageUsers}>
            {leaders.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            {!leaders.some((u) => u.id === Number(form.leader_id)) && <option value={form.leader_id}>{user.name}</option>}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Inicio" htmlFor="p-start">
            <input id="p-start" type="date" value={form.start_date} onChange={set("start_date")} />
          </Field>
          <Field label="Finalización" htmlFor="p-end" error={errors.end_date}>
            <input id="p-end" type="date" value={form.end_date} onChange={set("end_date")} />
          </Field>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={form.requires_approval}
            onChange={(e) => setForm((f) => ({ ...f, requires_approval: e.target.checked }))} />
          <span>
            Las tareas requieren aprobación del líder
            <small>Los colaboradores envían a «En revisión» y el líder aprueba o rechaza.</small>
          </span>
        </label>
        <Field label="Participantes" htmlFor="p-members">
          <PeoplePicker id="p-members" users={users.filter((u) => u.id !== Number(form.leader_id) && u.active !== false)}
            value={form.member_ids} onChange={(ids) => setForm((f) => ({ ...f, member_ids: ids }))} />
        </Field>
      </form>
    </Drawer>
  );
}
