import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { toISO, addDays, startOfWeek, todayISO, parseDate, PRIORITY_LABEL } from "../lib/format";
import { PageHeader, ErrorBox, AvatarStack, Empty } from "../components/ui";
import TaskDrawer from "../components/TaskDrawer";
import TaskForm from "../components/TaskForm";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const VIEWS = [
  { id: "mes", label: "Mes" },
  { id: "semana", label: "Semana" },
  { id: "dia", label: "Día" }
];

// Rango visible según la vista
function rangeFor(view, cursor) {
  if (view === "dia") return { start: cursor, days: 1 };
  if (view === "semana") return { start: startOfWeek(cursor), days: 7 };
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const days = Math.round((startOfWeek(last) - start) / 86400000) + 7;
  return { start, days };
}

function title(view, cursor, range) {
  if (view === "mes") {
    const s = cursor.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (view === "dia") {
    const s = cursor.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const end = addDays(range.start, 6);
  const a = range.start.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const b = end.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  return `${a} – ${b}`;
}

// RF-061 a RF-066: calendario de tareas y fechas de proyectos
export default function Calendar() {
  const { user } = useAuth();
  const notify = useToast();
  const [view, setView] = useState(() => (window.innerWidth < 640 ? "dia" : "mes"));
  const [cursor, setCursor] = useState(() => parseDate(todayISO()));
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ project_id: "", assignee_id: "" });
  const [showMilestones, setShowMilestones] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openTask, setOpenTask] = useState(null);
  const [form, setForm] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overDay, setOverDay] = useState(null);

  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const days = useMemo(() => Array.from({ length: range.days }, (_, i) => addDays(range.start, i)), [range]);
  const from = toISO(days[0]);
  const to = toISO(days[days.length - 1]);
  const today = todayISO();

  const load = useCallback(async () => {
    setError("");
    const qs = new URLSearchParams({ from, to });
    if (filters.project_id) qs.set("project_id", filters.project_id);
    if (filters.assignee_id) qs.set("assignee_id", filters.assignee_id);
    try {
      setTasks(await api(`/tasks?${qs}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([api("/projects"), api("/users")])
      .then(([p, u]) => { setProjects(p); setUsers(u); })
      .catch((err) => setError(err.message));
  }, []);

  // Eventos por día: tareas por su vencimiento y, si se pide, inicio y fin de los proyectos (RF-063, RF-066)
  const byDay = useMemo(() => {
    const map = {};
    const push = (iso, item) => { (map[iso] ||= []).push(item); };
    tasks.forEach((t) => push(t.due_date, { kind: "task", task: t }));
    if (showMilestones) {
      projects
        .filter((p) => !filters.project_id || String(p.id) === String(filters.project_id))
        .forEach((p) => {
          if (p.start_date && p.start_date >= from && p.start_date <= to) push(p.start_date, { kind: "start", project: p });
          if (p.end_date && p.end_date >= from && p.end_date <= to) push(p.end_date, { kind: "end", project: p });
        });
    }
    Object.values(map).forEach((list) =>
      list.sort((a, b) => (a.kind === "task") - (b.kind === "task") || (b.task?.priority_order || 0) - (a.task?.priority_order || 0))
    );
    return map;
  }, [tasks, projects, showMilestones, filters.project_id, from, to]);

  const move = (dir) => {
    if (view === "mes") setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));
    else setCursor((c) => addDays(c, view === "semana" ? 7 * dir : dir));
  };

  // RF-065: arrastrar una tarea a otro día la reprograma (solo líder del proyecto o administrador)
  const reschedule = async (taskId, iso) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.due_date === iso) return;
    const previous = tasks;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, due_date: iso } : t)));
    try {
      const updated = await api(`/tasks/${taskId}/reschedule`, { method: "PATCH", body: { due_date: iso } });
      setTasks((ts) => ts.map((t) => (t.id === taskId ? updated : t)));
      notify(`«${task.title}» ahora vence el ${parseDate(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}.`);
    } catch (err) {
      setTasks(previous);
      notify(err.message, "error");
    }
  };

  const dropProps = (iso) => ({
    onDragOver: (e) => { if (dragId) { e.preventDefault(); setOverDay(iso); } },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverDay(null); },
    onDrop: (e) => {
      e.preventDefault();
      setOverDay(null);
      if (dragId) reschedule(dragId, iso);
      setDragId(null);
    }
  });

  const renderItem = (item, compact) => {
    if (item.kind !== "task") {
      const p = item.project;
      return (
        <a key={`${item.kind}-${p.id}`} href={`#/tablero?proyecto=${p.id}`} className={`cal-milestone m-${item.kind}`}
          title={`${item.kind === "start" ? "Inicio" : "Fin"} del proyecto ${p.name}`}>
          <Flag size={12} aria-hidden="true" />
          <span>{item.kind === "start" ? "Inicia" : "Termina"}: {p.name}</span>
        </a>
      );
    }
    const t = item.task;
    return (
      <button
        key={t.id}
        type="button"
        className={`cal-task st-${t.status_id}${t.is_overdue ? " is-overdue" : ""}${dragId === t.id ? " is-dragging" : ""}${compact ? "" : " cal-task-full"}`}
        draggable={t.can_manage}
        onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={() => { setDragId(null); setOverDay(null); }}
        onClick={() => setOpenTask(t.id)}
        title={`${t.title} · ${t.status_name}${t.is_overdue ? " · Vencida" : ""}`}
      >
        <span className="cal-dot" aria-hidden="true" />
        <span className="cal-task-title">{t.title}</span>
        {!compact && (
          <span className="cal-task-meta">
            <span>{t.project_name}</span>
            <span className={`prio p-${t.priority_id}`}>{PRIORITY_LABEL[t.priority_id]}</span>
            <span>{t.status_name}</span>
            {t.is_overdue && <span className="chip chip-overdue">Vencida</span>}
            <AvatarStack people={t.assignees} />
          </span>
        )}
      </button>
    );
  };

  const MAX_IN_CELL = 3;
  const manageable = projects.filter((p) => p.can_manage);

  return (
    <div className="page page-wide calendar-page">
      <PageHeader
        title="Calendario"
        description="Vencimientos de las tareas y fechas clave de los proyectos. Si lideras el proyecto, arrastra una tarea a otro día para reprogramarla."
      />

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="icon-btn icon-btn-bordered" onClick={() => move(-1)} aria-label="Anterior">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCursor(parseDate(todayISO()))}>Hoy</button>
          <button type="button" className="icon-btn icon-btn-bordered" onClick={() => move(1)} aria-label="Siguiente">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <h2 className="cal-title" aria-live="polite">{title(view, cursor, range)}</h2>
        </div>
        <div className="segmented" role="group" aria-label="Vista del calendario">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>
          ))}
        </div>
      </div>

      <div className="filters-bar">
        <label className="sr-only" htmlFor="c-project">Proyecto</label>
        <select id="c-project" value={filters.project_id} onChange={(e) => setFilters((f) => ({ ...f, project_id: e.target.value }))}>
          <option value="">Todos los proyectos</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="c-assignee">Responsable</label>
        <select id="c-assignee" value={filters.assignee_id} onChange={(e) => setFilters((f) => ({ ...f, assignee_id: e.target.value }))}>
          <option value="">Todos los responsables</option>
          <option value={user.id}>Mis tareas</option>
          {users.filter((u) => u.id !== user.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="check-inline">
          <input type="checkbox" checked={showMilestones} onChange={(e) => setShowMilestones(e.target.checked)} />
          Fechas de proyectos
        </label>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}

      {view === "mes" && (
        <div className="cal-month" aria-busy={loading}>
          {WEEKDAYS.map((d, i) => <div key={d} className={`cal-weekday${i > 4 ? " is-weekend" : ""}`}>{d}</div>)}
          {days.map((d) => {
            const iso = toISO(d);
            const items = byDay[iso] || [];
            const outside = d.getMonth() !== cursor.getMonth();
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div key={iso}
                className={`cal-cell${outside ? " is-outside" : ""}${weekend ? " is-weekend" : ""}${iso === today ? " is-today" : ""}${overDay === iso ? " is-over" : ""}`}
                {...dropProps(iso)}>
                <button type="button" className="cal-daynum" onClick={() => { setCursor(d); setView("dia"); }}
                  aria-label={`${d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}: ${items.length} elementos. Ver día`}>
                  {d.getDate()}
                </button>
                <div className="cal-items">
                  {items.slice(0, MAX_IN_CELL).map((it) => renderItem(it, true))}
                  {items.length > MAX_IN_CELL && (
                    <button type="button" className="cal-more" onClick={() => { setCursor(d); setView("dia"); }}>
                      +{items.length - MAX_IN_CELL} más
                    </button>
                  )}
                </div>
                {items.length > 0 && <span className="cal-count" aria-hidden="true">{items.length}</span>}
              </div>
            );
          })}
        </div>
      )}

      {view === "semana" && (
        <div className="cal-week" aria-busy={loading}>
          {days.map((d, i) => {
            const iso = toISO(d);
            const items = byDay[iso] || [];
            return (
              <section key={iso} className={`cal-wcol${iso === today ? " is-today" : ""}${overDay === iso ? " is-over" : ""}${i > 4 ? " is-weekend" : ""}`}
                {...dropProps(iso)} aria-label={d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}>
                <button type="button" className="cal-whead" onClick={() => { setCursor(d); setView("dia"); }}>
                  <span>{WEEKDAYS[i]}</span>
                  <strong>{d.getDate()}</strong>
                </button>
                <div className="cal-items">
                  {items.map((it) => renderItem(it, true))}
                  {items.length === 0 && <p className="cal-empty">—</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === "dia" && (
        <div className="cal-day" aria-busy={loading}>
          {(byDay[toISO(cursor)] || []).length === 0 ? (
            !loading && <Empty title="Nada vence este día">Usa las flechas para ver otros días o cambia a la vista de semana o mes.</Empty>
          ) : (
            <div className="cal-day-list">{(byDay[toISO(cursor)] || []).map((it) => renderItem(it, false))}</div>
          )}
        </div>
      )}

      <div className="cal-legend" aria-label="Convenciones">
        <span><span className="cal-dot st-en_progreso" aria-hidden="true" /> Color = estado de la tarea</span>
        <span><span className="lg-overdue" aria-hidden="true" /> Vencida</span>
        <span><Flag size={12} aria-hidden="true" /> Inicio o fin de proyecto</span>
      </div>

      {openTask && (
        <TaskDrawer
          taskId={openTask}
          onClose={() => setOpenTask(null)}
          onChanged={load}
          onEdit={(task) => { setOpenTask(null); setForm({ task }); }}
        />
      )}
      {form && (
        <TaskForm
          task={form.task}
          projects={form.task ? projects : manageable}
          users={users}
          onClose={() => setForm(null)}
          onSaved={() => { notify("Tarea actualizada."); setForm(null); load(); }}
        />
      )}
    </div>
  );
}
