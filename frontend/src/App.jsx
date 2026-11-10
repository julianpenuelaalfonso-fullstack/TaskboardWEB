import { useEffect, useState } from "react";
const API = import.meta.env.VITE_API_URL;

// fetch que lanza un Error con el mensaje de la API cuando la respuesta no es 2xx.
async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function TaskRow({ task, busy, onToggle, onDelete }) {
  return (
    <li className={task.done ? "task is-done" : "task"}>
      <label className="task-check">
        <input type="checkbox" checked={task.done} disabled={busy} onChange={onToggle} />
        <span className="task-title">{task.title}</span>
      </label>
      <button className="task-delete" disabled={busy} onClick={onDelete} aria-label={`Eliminar "${task.title}"`}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

function summary(pending, done) {
  if (pending === 0 && done === 0) return "Tu tablero está vacío.";
  if (pending === 0) return "Todo al día. No te queda nada pendiente.";
  return pending === 1 ? "Te queda 1 tarea pendiente." : `Te quedan ${pending} tareas pendientes.`;
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setTasks(await request("/api/tasks"));
    } catch {
      setError("No hay conexión con el servidor. Revisa que la API esté encendida y vuelve a intentarlo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Ejecuta una acción contra la API y recarga la lista; muestra el error si falla.
  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message || "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const addTask = (e) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return setFieldError("Escribe qué hay que hacer antes de agregarla.");
    setFieldError("");
    run(async () => {
      await request("/api/tasks", { method: "POST", body: JSON.stringify({ title: clean }) });
      setTitle("");
    });
  };

  const toggleTask = (t) =>
    run(() => request(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ done: !t.done }) }));

  const deleteTask = (t) => run(() => request(`/api/tasks/${t.id}`, { method: "DELETE" }));

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const firstLoad = loading && tasks.length === 0;

  const row = (t) => (
    <TaskRow key={t.id} task={t} busy={busy} onToggle={() => toggleTask(t)} onDelete={() => deleteTask(t)} />
  );

  return (
    <main>
      <header className="masthead">
        <h1>TaskBoard</h1>
        {!firstLoad && !error && <p className="summary">{summary(pending.length, done.length)}</p>}
      </header>

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
        <button disabled={busy}>Agregar tarea</button>
      </form>
      {fieldError && <p id="title-error" className="field-error">{fieldError}</p>}

      {error && (
        <div className="alert" role="alert">
          <p>{error}</p>
          <button className="alert-retry" onClick={load} disabled={loading}>Reintentar</button>
        </div>
      )}

      {firstLoad ? (
        <div className="loading" role="status">
          <div className="loading-bar" aria-hidden="true" />
          <p>Conectando con el servidor…</p>
          <p className="muted">Si estaba en reposo, puede tardar hasta un minuto en responder.</p>
        </div>
      ) : tasks.length === 0 ? (
        !error && <p className="empty">Escribe tu primera tarea arriba y pulsa Agregar tarea.</p>
      ) : (
        <>
          <section aria-labelledby="pending-heading">
            <h2 id="pending-heading">Pendientes <span className="count">{pending.length}</span></h2>
            {pending.length > 0
              ? <ul>{pending.map(row)}</ul>
              : <p className="muted">Nada pendiente.</p>}
          </section>
          {done.length > 0 && (
            <section aria-labelledby="done-heading">
              <h2 id="done-heading">Hechas <span className="count">{done.length}</span></h2>
              <ul>{done.map(row)}</ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
