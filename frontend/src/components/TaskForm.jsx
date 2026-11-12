import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Drawer, Field, PeoplePicker } from "./ui";

// Crear o editar una tarea (RF-030 a RF-035, RF-038, RF-041, RF-042)
export default function TaskForm({ task, projects, users, defaultProjectId, onClose, onSaved }) {
  const { meta } = useAuth();
  const editing = Boolean(task);
  const [form, setForm] = useState(() => ({
    project_id: task?.project_id ?? defaultProjectId ?? projects[0]?.id ?? "",
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority_id: task?.priority_id ?? "media",
    start_date: task?.start_date ?? "",
    due_date: task?.due_date ?? "",
    estimated_hours: task?.estimated_hours ?? "",
    actual_hours: task?.actual_hours ?? "",
    tags: (task?.tags ?? []).join(", "),
    assignee_ids: task?.assignees?.map((a) => a.id) ?? []
  }));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  // Validación en el cliente con los mismos criterios del servidor (RN-002 a RN-004)
  const validate = () => {
    const e = {};
    if (!form.project_id) e.project_id = "Selecciona el proyecto.";
    if (!form.title.trim()) e.title = "Escribe el título.";
    if (!form.description.trim()) e.description = "Describe qué hay que hacer.";
    if (!form.due_date) e.due_date = "Indica la fecha de vencimiento.";
    if (form.start_date && form.due_date && form.due_date < form.start_date) {
      e.due_date = "No puede ser anterior a la fecha de inicio.";
    }
    if (!form.assignee_ids.length) e.assignee_ids = "Asigna al menos un responsable.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;
    setBusy(true);
    const body = {
      ...form,
      project_id: Number(form.project_id),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      estimated_hours: form.estimated_hours === "" ? null : Number(form.estimated_hours),
      actual_hours: form.actual_hours === "" ? null : Number(form.actual_hours)
    };
    try {
      const saved = editing
        ? await api(`/tasks/${task.id}`, { method: "PUT", body })
        : await api("/tasks", { method: "POST", body });
      onSaved(saved);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      title={editing ? "Editar tarea" : "Nueva tarea"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="task-form" className="btn btn-primary" disabled={busy}>
            {busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
            {editing ? "Guardar cambios" : "Crear tarea"}
          </button>
        </>
      }
    >
      <form id="task-form" className="form" onSubmit={submit} noValidate>
        {serverError && <p className="form-error" role="alert">{serverError}</p>}

        <Field label="Proyecto" htmlFor="t-project" error={errors.project_id} required>
          <select id="t-project" value={form.project_id} onChange={set("project_id")} disabled={editing}>
            {projects.length === 0 && <option value="">No lideras proyectos activos</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>

        <Field label="Título" htmlFor="t-title" error={errors.title} required>
          <input id="t-title" value={form.title} onChange={set("title")} maxLength={200} />
        </Field>

        <Field label="Descripción" htmlFor="t-desc" error={errors.description} required>
          <textarea id="t-desc" rows={4} value={form.description} onChange={set("description")} />
        </Field>

        <div className="form-row">
          <Field label="Prioridad" htmlFor="t-priority">
            <select id="t-priority" value={form.priority_id} onChange={set("priority_id")}>
              {meta.priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Etiquetas" htmlFor="t-tags" hint="Sepáralas con comas">
            <input id="t-tags" value={form.tags} onChange={set("tags")} placeholder="backend, cliente" />
          </Field>
        </div>

        <div className="form-row">
          <Field label="Inicio" htmlFor="t-start">
            <input id="t-start" type="date" value={form.start_date} onChange={set("start_date")} />
          </Field>
          <Field label="Vencimiento" htmlFor="t-due" error={errors.due_date} required>
            <input id="t-due" type="date" value={form.due_date} onChange={set("due_date")} />
          </Field>
        </div>

        <div className="form-row">
          <Field label="Tiempo estimado (h)" htmlFor="t-est">
            <input id="t-est" type="number" min="0" step="0.5" value={form.estimated_hours} onChange={set("estimated_hours")} />
          </Field>
          {editing && (
            <Field label="Tiempo real (h)" htmlFor="t-real">
              <input id="t-real" type="number" min="0" step="0.5" value={form.actual_hours} onChange={set("actual_hours")} />
            </Field>
          )}
        </div>

        <Field label="Responsables" htmlFor="t-people" error={errors.assignee_ids} required>
          <PeoplePicker
            id="t-people"
            users={users.filter((u) => u.active !== false && u.role_id !== "invitado")}
            value={form.assignee_ids}
            onChange={(ids) => {
              setForm((f) => ({ ...f, assignee_ids: ids }));
              if (errors.assignee_ids) setErrors((er) => ({ ...er, assignee_ids: undefined }));
            }}
          />
        </Field>
      </form>
    </Drawer>
  );
}
