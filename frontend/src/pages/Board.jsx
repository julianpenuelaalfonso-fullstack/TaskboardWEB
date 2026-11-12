import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, CalendarClock, ListChecks, X } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { dueLabel, PRIORITY_LABEL } from "../lib/format";
import { AvatarStack, PageHeader, ErrorBox } from "../components/ui";
import TaskDrawer from "../components/TaskDrawer";
import TaskForm from "../components/TaskForm";

// RF-045 a RF-054: tablero Kanban por estados
export default function Board({ params }) {
  const { user, meta, permissions } = useAuth();
  const notify = useToast();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    project_id: params.proyecto || "",
    assignee_id: "",
    priority_id: "",
    q: "",
    overdue: false
  });
  const [query, setQuery] = useState("");
  const [openTask, setOpenTask] = useState(null);
  const [form, setForm] = useState(null); // { task?: ... }
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  useEffect(() => {
    if (params.proyecto) setFilters((f) => ({ ...f, project_id: params.proyecto }));
  }, [params.proyecto]);

  // Búsqueda con pequeña espera para no llamar a la API en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: query.trim() })), 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadTasks = useCallback(async () => {
    setError("");
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v === true ? "true" : v));
    try {
      setTasks(await api(`/tasks?${qs}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  useEffect(() => {
    Promise.all([api("/projects"), api("/users")])
      .then(([p, u]) => { setProjects(p); setUsers(u); })
      .catch((err) => setError(err.message));
  }, []);

  const manageable = projects.filter((p) => p.can_manage);
  const columns = useMemo(
    () => meta.statuses.map((s) => ({ ...s, tasks: tasks.filter((t) => t.status_id === s.id) })),
    [meta.statuses, tasks]
  );

  // RF-048: mover la tarjeta actualiza el estado (con reversión si el servidor lo rechaza)
  const moveTask = async (taskId, statusId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status_id === statusId) return;
    const previous = tasks;
    const name = meta.statuses.find((s) => s.id === statusId)?.name;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status_id: statusId } : t)));
    try {
      const updated = await api(`/tasks/${taskId}/status`, { method: "PATCH", body: { status_id: statusId } });
      setTasks((ts) => ts.map((t) => (t.id === taskId ? updated : t)));
      notify(`«${task.title}» pasó a ${name}.`);
    } catch (err) {
      setTasks(previous);
      notify(err.message, "error");
    }
  };

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const activeFilters = filters.project_id || filters.assignee_id || filters.priority_id || filters.q || filters.overdue;
  const overdueCount = tasks.filter((t) => t.is_overdue).length;
  const currentProject = projects.find((p) => String(p.id) === String(filters.project_id));

  return (
    <div className="board-page">
      <PageHeader
        title={currentProject ? currentProject.name : "Tablero"}
        description={
          currentProject
            ? `Líder: ${currentProject.leader_name} · ${currentProject.progress}% de avance`
            : permissions.viewAll ? "Tareas de todos los proyectos activos." : "Tareas de los proyectos en los que participas."
        }
        actions={
          manageable.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => setForm({})}>
              <Plus size={18} aria-hidden="true" /> Nueva tarea
            </button>
          )
        }
      />

      <div className="filters-bar" role="search">
        <div className="search">
          <Search size={17} aria-hidden="true" />
          <label htmlFor="f-q" className="sr-only">Buscar tareas por nombre</label>
          <input id="f-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre" />
        </div>
        <label className="sr-only" htmlFor="f-project">Proyecto</label>
        <select id="f-project" value={filters.project_id} onChange={set("project_id")}>
          <option value="">Todos los proyectos</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-assignee">Responsable</label>
        <select id="f-assignee" value={filters.assignee_id} onChange={set("assignee_id")}>
          <option value="">Todos los responsables</option>
          <option value={user.id}>Mis tareas</option>
          {users.filter((u) => u.id !== user.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-priority">Prioridad</label>
        <select id="f-priority" value={filters.priority_id} onChange={set("priority_id")}>
          <option value="">Todas las prioridades</option>
          {meta.priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button type="button" className={filters.overdue ? "toggle is-on" : "toggle"} aria-pressed={filters.overdue}
          onClick={() => setFilters((f) => ({ ...f, overdue: !f.overdue }))}>
          <CalendarClock size={16} aria-hidden="true" /> Vencidas
          {!filters.overdue && overdueCount > 0 && <span className="toggle-count">{overdueCount}</span>}
        </button>
        {activeFilters && (
          <button type="button" className="link-btn" onClick={() => {
            setQuery("");
            setFilters({ project_id: "", assignee_id: "", priority_id: "", q: "", overdue: false });
            window.location.hash = "#/tablero";
          }}>
            <X size={15} aria-hidden="true" /> Limpiar
          </button>
        )}
      </div>

      {error && <ErrorBox message={error} onRetry={loadTasks} />}

      <div className="kanban" aria-busy={loading}>
        {columns.map((col) => (
          <section
            key={col.id}
            className={`column c-${col.id}${overCol === col.id ? " is-over" : ""}`}
            aria-label={`${col.name}: ${col.tasks.length} tareas`}
            onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverCol(col.id); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              if (dragId) moveTask(dragId, col.id);
              setDragId(null);
            }}
          >
            <header className="column-head">
              <span className="column-dot" aria-hidden="true" />
              <h2>{col.name}</h2>
              <span className="column-count">{col.tasks.length}</span>
            </header>
            <div className="column-body">
              {loading && <div className="card-skeleton" aria-hidden="true" />}
              {!loading && col.tasks.length === 0 && <p className="column-empty">Sin tareas</p>}
              {col.tasks.map((t) => {
                const closed = ["finalizada", "cancelada"].includes(t.status_id);
                return (
                  <article
                    key={t.id}
                    className={`card${t.is_overdue ? " is-overdue" : ""}${dragId === t.id ? " is-dragging" : ""}`}
                    draggable={t.can_work}
                    onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  >
                    <button type="button" className="card-open" onClick={() => setOpenTask(t.id)}>
                      <span className="card-project">{t.project_name}</span>
                      <span className="card-title">{t.title}</span>
                    </button>
                    <div className="card-meta">
                      <span className={`prio p-${t.priority_id}`}>{PRIORITY_LABEL[t.priority_id]}</span>
                      <span className={t.is_overdue ? "due is-overdue" : "due"}>
                        <CalendarClock size={14} aria-hidden="true" />
                        {t.is_overdue ? "Vencida · " : ""}{dueLabel(t.due_date, closed)}
                      </span>
                    </div>
                    <div className="card-foot">
                      <AvatarStack people={t.assignees} />
                      {t.subtask_total > 0 && (
                        <span className="card-sub" title="Subtareas completadas">
                          <ListChecks size={14} aria-hidden="true" /> {t.subtask_done}/{t.subtask_total}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {openTask && (
        <TaskDrawer
          taskId={openTask}
          onClose={() => setOpenTask(null)}
          onChanged={loadTasks}
          onEdit={(task) => { setOpenTask(null); setForm({ task }); }}
        />
      )}
      {form && (
        <TaskForm
          task={form.task}
          projects={form.task ? projects : manageable}
          users={users}
          defaultProjectId={manageable.some((p) => String(p.id) === String(filters.project_id)) ? Number(filters.project_id) : undefined}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            notify(form.task ? "Tarea actualizada." : `Tarea «${saved.title}» creada.`);
            setForm(null);
            loadTasks();
            setOpenTask(saved.id);
          }}
        />
      )}
    </div>
  );
}
