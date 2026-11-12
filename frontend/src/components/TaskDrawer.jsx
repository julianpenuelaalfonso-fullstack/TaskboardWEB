import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Copy, Archive, Trash2, Pencil, Check, X, Plus, Clock } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { formatDate, formatDateTime, dueLabel, PRIORITY_LABEL } from "../lib/format";
import { Drawer, Avatar, Loading, ErrorBox } from "./ui";

// Detalle de la tarea: estado, aprobación, subtareas, tiempo e historial
export default function TaskDrawer({ taskId, onClose, onChanged, onEdit }) {
  const { meta, permissions } = useAuth();
  const notify = useToast();
  const [task, setTask] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [subtask, setSubtask] = useState("");
  const [hours, setHours] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const t = await api(`/tasks/${taskId}`);
      setTask(t);
      setHours(t.actual_hours ?? "");
    } catch (err) {
      setError(err.message);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  // Ejecuta una acción, recarga el detalle y avisa al tablero
  const run = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      await load();
      onChanged();
      if (okMessage) notify(okMessage);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const closed = task && ["finalizada", "cancelada"].includes(task.status_id);

  // Estados que este usuario puede elegir
  const statusOptions = meta.statuses.filter((s) => {
    if (!task || task.can_manage || s.id === task.status_id) return true;
    if (s.id === "cancelada") return false;
    if (s.id === "finalizada" && task.requires_approval) return false;
    return true;
  });

  return (
    <Drawer title={task ? `Tarea #${task.id}` : "Tarea"} onClose={onClose} wide>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!task && !error && <Loading />}
      {task && (
        <div className="task-detail">
          <div className="detail-head">
            <p className="detail-project">{task.project_name}</p>
            <h3 className="detail-title">{task.title}</h3>
            <div className="chips">
              <span className={`chip chip-status s-${task.status_id}`}>{task.status_name}</span>
              <span className={`chip chip-priority p-${task.priority_id}`}>Prioridad {PRIORITY_LABEL[task.priority_id].toLowerCase()}</span>
              {task.is_overdue && <span className="chip chip-overdue">Vencida</span>}
              {task.archived && <span className="chip">Archivada</span>}
            </div>
          </div>

          {(task.can_manage || permissions.manageUsers) && (
            <div className="detail-actions">
              {task.can_manage && (
                <>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(task)} disabled={busy}>
                    <Pencil size={16} aria-hidden="true" /> Editar
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
                    onClick={() => run(async () => {
                      const copy = await api(`/tasks/${task.id}/duplicate`, { method: "POST" });
                      notify(`Se creó «${copy.title}».`);
                    })}>
                    <Copy size={16} aria-hidden="true" /> Duplicar
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
                    onClick={() => run(
                      () => api(`/tasks/${task.id}/archive`, { method: "PATCH", body: { archived: !task.archived } }),
                      task.archived ? "Tarea restaurada." : "Tarea archivada."
                    )}>
                    <Archive size={16} aria-hidden="true" /> {task.archived ? "Restaurar" : "Archivar"}
                  </button>
                </>
              )}
              {permissions.manageUsers && task.status_id !== "cancelada" && (
                <button type="button" className="btn btn-danger-ghost btn-sm" disabled={busy}
                  onClick={async () => {
                    if (!window.confirm(`¿Eliminar definitivamente «${task.title}»? Esta acción no se puede deshacer.`)) return;
                    try {
                      await api(`/tasks/${task.id}`, { method: "DELETE" });
                      notify("Tarea eliminada.");
                      onChanged();
                      onClose();
                    } catch (err) {
                      notify(err.message, "error");
                    }
                  }}>
                  <Trash2 size={16} aria-hidden="true" /> Eliminar
                </button>
              )}
            </div>
          )}

          {/* RF-058, RF-059: aprobación del líder */}
          {task.status_id === "en_revision" && task.can_manage && (
            <section className="review">
              <h4>Revisión pendiente</h4>
              <p className="muted">Aprueba la tarea para finalizarla o recházala con observaciones para que vuelva a «En progreso».</p>
              <label htmlFor="review-note" className="sr-only">Observaciones</label>
              <textarea id="review-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Observaciones (obligatorias si rechazas)" />
              <div className="review-actions">
                <button type="button" className="btn btn-primary btn-sm" disabled={busy}
                  onClick={() => run(async () => {
                    await api(`/tasks/${task.id}/review`, { method: "POST", body: { decision: "aprobar", note } });
                    setNote("");
                  }, "Tarea aprobada y finalizada.")}>
                  <Check size={16} aria-hidden="true" /> Aprobar
                </button>
                <button type="button" className="btn btn-danger-ghost btn-sm" disabled={busy}
                  onClick={() => {
                    if (!note.trim()) return notify("Escribe las observaciones del rechazo.", "error");
                    run(async () => {
                      await api(`/tasks/${task.id}/review`, { method: "POST", body: { decision: "rechazar", note } });
                      setNote("");
                    }, "Tarea rechazada. El equipo verá tus observaciones.");
                  }}>
                  <X size={16} aria-hidden="true" /> Rechazar
                </button>
              </div>
            </section>
          )}

          <dl className="facts">
            <div>
              <dt>Estado</dt>
              <dd>
                {task.can_work ? (
                  <select aria-label="Cambiar estado" value={task.status_id} disabled={busy}
                    onChange={(e) => run(
                      () => api(`/tasks/${task.id}/status`, { method: "PATCH", body: { status_id: e.target.value } }),
                      "Estado actualizado."
                    )}>
                    {statusOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : task.status_name}
                {task.can_work && !task.can_manage && task.requires_approval && !closed && task.status_id !== "en_revision" && (
                  <small className="fact-hint">Para finalizar, envíala a «En revisión».</small>
                )}
              </dd>
            </div>
            <div>
              <dt>Vencimiento</dt>
              <dd className={task.is_overdue ? "is-overdue" : ""}>
                <CalendarClock size={16} aria-hidden="true" />
                {formatDate(task.due_date, { day: "numeric", month: "long", year: "numeric" })}
                {dueLabel(task.due_date, closed) !== formatDate(task.due_date) && (
                  <small className="fact-hint">{dueLabel(task.due_date, closed)}</small>
                )}
              </dd>
            </div>
            <div>
              <dt>Inicio</dt>
              <dd>{task.start_date ? formatDate(task.start_date, { day: "numeric", month: "long", year: "numeric" }) : "Sin fecha"}</dd>
            </div>
            <div>
              <dt>Tiempo</dt>
              <dd>
                <Clock size={16} aria-hidden="true" />
                {task.actual_hours ?? 0} h reales de {task.estimated_hours ?? "—"} h estimadas
              </dd>
            </div>
          </dl>

          <section>
            <h4>Responsables</h4>
            <ul className="people">
              {task.assignees.map((a) => (
                <li key={a.id}><Avatar name={a.name} size="sm" /> {a.name}</li>
              ))}
            </ul>
          </section>

          <section>
            <h4>Descripción</h4>
            <p className="prose">{task.description}</p>
            {task.tags.length > 0 && (
              <div className="tags">{task.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>
            )}
          </section>

          {/* RF-036: subtareas */}
          <section>
            <h4>
              Subtareas
              {task.subtasks.length > 0 && (
                <span className="count">{task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}</span>
              )}
            </h4>
            {task.subtasks.length === 0 && <p className="muted">Sin subtareas.</p>}
            <ul className="subtasks">
              {task.subtasks.map((s) => (
                <li key={s.id} className={s.done ? "is-done" : ""}>
                  <label>
                    <input type="checkbox" checked={s.done} disabled={!task.can_work || busy}
                      onChange={() => run(() => api(`/tasks/${task.id}/subtasks/${s.id}`, { method: "PATCH", body: { done: !s.done } }))} />
                    <span>{s.title}</span>
                  </label>
                  {task.can_manage && (
                    <button type="button" className="icon-btn" aria-label={`Eliminar subtarea ${s.title}`} disabled={busy}
                      onClick={() => run(() => api(`/tasks/${task.id}/subtasks/${s.id}`, { method: "DELETE" }))}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {task.can_work && (
              <form className="inline-form" onSubmit={(e) => {
                e.preventDefault();
                if (!subtask.trim()) return;
                run(async () => {
                  await api(`/tasks/${task.id}/subtasks`, { method: "POST", body: { title: subtask } });
                  setSubtask("");
                });
              }}>
                <label htmlFor="new-subtask" className="sr-only">Nueva subtarea</label>
                <input id="new-subtask" value={subtask} onChange={(e) => setSubtask(e.target.value)} placeholder="Agregar subtarea" />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
                  <Plus size={16} aria-hidden="true" /> Agregar
                </button>
              </form>
            )}
          </section>

          {/* RF-043: tiempo real utilizado */}
          {task.can_work && !task.can_manage && (
            <section>
              <h4>Registrar tiempo real</h4>
              <form className="inline-form" onSubmit={(e) => {
                e.preventDefault();
                run(() => api(`/tasks/${task.id}/time`, { method: "PATCH", body: { actual_hours: Number(hours) } }), "Tiempo registrado.");
              }}>
                <label htmlFor="real-hours" className="sr-only">Horas reales</label>
                <input id="real-hours" type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
                <span className="muted">horas</span>
                <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>Guardar</button>
              </form>
            </section>
          )}

          {/* RF-044, RF-056, RF-057: historial */}
          <section>
            <h4>Historial</h4>
            <ol className="history">
              {task.history.map((h) => (
                <li key={h.id} className={`h-${h.action}`}>
                  <p>
                    <strong>{h.user_name || "Sistema"}</strong> {h.detail}
                  </p>
                  <time dateTime={h.created_at}>{formatDateTime(h.created_at)}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Drawer>
  );
}
