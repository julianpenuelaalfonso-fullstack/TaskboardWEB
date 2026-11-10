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

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setTasks(await request("/api/tasks"));
    } catch {
      setError("No se pudo conectar con la API. Si es la primera visita, el servidor puede tardar hasta un minuto en despertar.");
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
    if (!clean) return setError("Escribe un título para la tarea.");
    run(async () => {
      await request("/api/tasks", { method: "POST", body: JSON.stringify({ title: clean }) });
      setTitle("");
    });
  };

  const toggleTask = (t) =>
    run(() => request(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ done: !t.done }) }));

  const deleteTask = (t) => run(() => request(`/api/tasks/${t.id}`, { method: "DELETE" }));

  const pending = tasks.filter((t) => !t.done).length;

  return (
    <main>
      <h1>TaskBoard</h1>

      <form onSubmit={addTask}>
        <label htmlFor="title" className="sr-only">Nueva tarea</label>
        <input
          id="title"
          value={title}
          maxLength={200}
          placeholder="¿Qué hay que hacer?"
          onChange={(e) => setTitle(e.target.value)}
        />
        <button disabled={busy}>Agregar</button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error} <button className="link" onClick={load}>Reintentar</button>
        </p>
      )}

      {loading && tasks.length === 0 ? (
        <p className="status" role="status">Cargando tareas…</p>
      ) : tasks.length === 0 ? (
        !error && <p className="status">No hay tareas todavía.</p>
      ) : (
        <>
          <p className="status">{pending} pendiente(s) de {tasks.length}</p>
          <ul>
            {tasks.map((t) => (
              <li key={t.id} className={t.done ? "done" : ""}>
                <label>
                  <input type="checkbox" checked={t.done} disabled={busy} onChange={() => toggleTask(t)} />
                  <span>{t.title}</span>
                </label>
                <button className="delete" disabled={busy} onClick={() => deleteTask(t)} aria-label={`Eliminar ${t.title}`}>
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
