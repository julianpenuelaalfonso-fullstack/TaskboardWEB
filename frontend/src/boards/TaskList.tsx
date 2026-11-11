import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCreateTask, useDeleteTask, useTasks, useToggleTask } from "../api/tasks";
import type { Task } from "../api/types";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
import "./boards.css";

const UNDO_MS = 5000;

function summary(pending: number, done: number) {
  if (pending === 0 && done === 0) return "Tu tablero está vacío.";
  if (pending === 0) return "Todo al día. No te queda nada pendiente.";
  return pending === 1 ? "Te queda 1 tarea pendiente." : `Te quedan ${pending} tareas pendientes.`;
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  return (
    <li className={task.done ? "task is-done" : "task"}>
      <label className="task-check">
        <input type="checkbox" checked={task.done} onChange={onToggle} />
        <span className="task-title">{task.title}</span>
      </label>
      <button type="button" className="task-delete" onClick={onDelete} aria-label={`Eliminar "${task.title}"`}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

export function TaskList({ boardId }: { boardId: string }) {
  const tasks = useTasks(boardId);
  const create = useCreateTask(boardId);
  const toggle = useToggleTask();
  const del = useDeleteTask();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, number>()); // id → temporizador del DELETE diferido
  const toasts = useRef(new Map<string, number>()); // id → toast con Deshacer
  const dismissToast = (id: string) => {
    const t = toasts.current.get(id);
    if (t !== undefined) toast.dismiss(t);
    toasts.current.delete(id);
  };

  const unhide = (id: string) => setHidden((h) => { const n = new Set(h); n.delete(id); return n; });

  const sendDelete = (id: string) => {
    timers.current.delete(id);
    dismissToast(id);
    // mutateAsync: los callbacks por llamada de mutate() se pierden si hay otro borrado en curso.
    del.mutateAsync({ id, boardId }).catch(() => {
      unhide(id);
      toast.show("No se pudo eliminar la tarea. Inténtalo de nuevo.");
    });
  };

  // Los borrados pendientes no se pierden: se envían al cerrar la pestaña (keepalive) o al salir del tablero.
  const latest = useRef({ sendDelete, dismissToast });
  latest.current = { sendDelete, dismissToast };
  useEffect(() => {
    const map = timers.current;
    const onPageHide = () => {
      for (const [id, t] of map) {
        clearTimeout(t);
        latest.current.dismissToast(id);
        void fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "same-origin", keepalive: true });
      }
      map.clear();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      for (const [id, t] of [...map]) { clearTimeout(t); latest.current.sendDelete(id); }
    };
  }, []);

  const removeTask = (t: Task) => {
    setHidden((h) => new Set(h).add(t.id));
    document.getElementById("title")?.focus(); // la fila desaparece: evita perder el foco
    timers.current.set(t.id, window.setTimeout(() => latest.current.sendDelete(t.id), UNDO_MS));
    const toastId = toast.show("Tarea eliminada", {
      actionLabel: "Deshacer",
      durationMs: UNDO_MS,
      onAction: () => {
        const timer = timers.current.get(t.id);
        if (timer === undefined) return; // ya se envió
        clearTimeout(timer);
        timers.current.delete(t.id);
        unhide(t.id);
      }
    });
    toasts.current.set(t.id, toastId);
  };

  const addTask = (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return setFieldError("Escribe qué hay que hacer antes de agregarla.");
    setFieldError("");
    // No borra lo que se haya escrito mientras se guardaba.
    create.mutate(clean, { onSuccess: () => setTitle((t) => (t.trim() === clean ? "" : t)) });
  };

  const visible = tasks.data?.filter((t) => !hidden.has(t.id)) ?? [];
  const pending = visible.filter((t) => !t.done);
  const done = visible.filter((t) => t.done);
  const error = tasks.error ?? create.error;
  const row = (t: Task) => (
    <TaskRow key={t.id} task={t}
      onToggle={() => toggle.mutate({ id: t.id, boardId, done: !t.done })}
      onDelete={() => removeTask(t)} />
  );

  return (
    <>
      {tasks.data && <p className="summary">{summary(pending.length, done.length)}</p>}

      <form className="composer" onSubmit={addTask} noValidate>
        <label htmlFor="title" className="sr-only">Nueva tarea</label>
        <input
          id="title"
          value={title}
          maxLength={200}
          autoComplete="off"
          placeholder="¿Qué hay que hacer?"
          aria-invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? "title-error" : undefined}
          onChange={(e) => { setTitle(e.target.value); if (fieldError) setFieldError(""); }}
        />
        <button disabled={create.isPending}>Agregar tarea</button>
      </form>
      {fieldError && <p id="title-error" className="field-error">{fieldError}</p>}

      {error && (
        <div className="alert" role="alert">
          <p>{error.message}</p>
          {tasks.error && <button type="button" className="alert-retry" onClick={() => void tasks.refetch()}>Reintentar</button>}
        </div>
      )}

      {tasks.isPending ? <Skeleton lines={4} /> : visible.length === 0 ? (
        !error && <p className="empty">Escribe tu primera tarea arriba y pulsa Agregar tarea.</p>
      ) : (
        <>
          <section aria-labelledby="pending-heading">
            <h2 id="pending-heading">Pendientes <span className="count">{pending.length}</span></h2>
            {pending.length > 0 ? <ul>{pending.map(row)}</ul> : <p className="muted">Nada pendiente.</p>}
          </section>
          {done.length > 0 && (
            <section aria-labelledby="done-heading">
              <h2 id="done-heading">Hechas <span className="count">{done.length}</span></h2>
              <ul>{done.map(row)}</ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
