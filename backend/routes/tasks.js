const express = require("express");
const pool = require("../db");
const { ah, HttpError, isDate, text, idParam } = require("../lib/http");
const P = require("../lib/permissions");

const router = express.Router();

const STATUS_NAMES = {
  pendiente: "Pendiente", por_iniciar: "Por iniciar", en_progreso: "En progreso",
  en_revision: "En revisión", en_espera: "En espera", finalizada: "Finalizada", cancelada: "Cancelada"
};

// RF-056, RF-057: quién hizo el cambio y cuándo (la fecha la pone la base de datos)
function logHistory(db, taskId, userId, action, detail) {
  return db.query(
    "INSERT INTO task_history (task_id, user_id, action, detail) VALUES ($1, $2, $3, $4)",
    [taskId, userId, action, detail]
  );
}

const TASK_SELECT = `
  SELECT t.*, p.name AS project_name, p.leader_id AS project_leader_id, p.archived AS project_archived,
         p.requires_approval, s.name AS status_name, pr.name AS priority_name, pr.sort_order AS priority_order,
         (t.due_date < CURRENT_DATE AND t.status_id NOT IN ('finalizada', 'cancelada')) AS is_overdue,
         COALESCE((SELECT json_agg(json_build_object('id', u.id, 'name', u.name) ORDER BY u.name)
                   FROM task_assignees a JOIN users u ON u.id = a.user_id WHERE a.task_id = t.id), '[]') AS assignees,
         (SELECT COUNT(*)::int FROM subtasks st WHERE st.task_id = t.id) AS subtask_total,
         (SELECT COUNT(*)::int FROM subtasks st WHERE st.task_id = t.id AND st.done) AS subtask_done
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  JOIN statuses s ON s.id = t.status_id
  JOIN priorities pr ON pr.id = t.priority_id`;

// Permisos del usuario sobre una fila de tarea
function withPermissions(user, task) {
  const project = { id: task.project_id, leader_id: task.project_leader_id };
  const canManage = P.canManageProject(user, project);
  const assigned = task.assignees.some((a) => a.id === user.id);
  const canWork = canManage || (assigned && !["invitado", "gerente"].includes(user.role_id));
  return { ...task, can_manage: canManage, can_work: canWork };
}

async function loadTask(id) {
  const { rows } = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [id]);
  return rows[0] || null;
}

async function loadTaskForUser(user, id) {
  const task = await loadTask(id);
  if (!task) throw new HttpError(404, "Tarea no encontrada.");
  const project = await P.getProject(task.project_id);
  const assigned = task.assignees.some((a) => a.id === user.id);
  if (!assigned && !(await P.canViewProject(user, project))) {
    throw new HttpError(403, "No tienes acceso a esta tarea.");
  }
  return { task: withPermissions(user, task), project };
}

// RF-045 a RF-054: listado para el Kanban con filtros y búsqueda
router.get("/", ah(async (req, res) => {
  const params = [];
  const where = [];
  const add = (value, clause) => { params.push(value); where.push(clause.replace("?", `$${params.length}`)); };

  if (!P.canViewAll(req.user)) {
    params.push(req.user.id);
    const me = `$${params.length}`;
    where.push(`(p.leader_id = ${me}
      OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = ${me})
      OR EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = ${me}))`);
  }
  if (req.query.project_id) add(Number(req.query.project_id), "t.project_id = ?");
  if (req.query.assignee_id) add(Number(req.query.assignee_id), "EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = ?)");
  if (req.query.priority_id) add(req.query.priority_id, "t.priority_id = ?");
  if (req.query.status_id) add(req.query.status_id, "t.status_id = ?");
  if (req.query.q) add(`%${req.query.q}%`, "t.title ILIKE ?");
  if (req.query.overdue === "true") where.push("t.due_date < CURRENT_DATE AND t.status_id NOT IN ('finalizada','cancelada')");
  if (req.query.archived !== "true") where.push("NOT t.archived");

  const { rows } = await pool.query(
    `${TASK_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY t.due_date, pr.sort_order DESC, t.id`,
    params
  );
  res.json(rows.map((t) => withPermissions(req.user, t)));
}));

// Detalle con subtareas e historial (RF-044)
router.get("/:id", ah(async (req, res) => {
  const { task } = await loadTaskForUser(req.user, idParam(req.params.id));
  const [subtasks, history] = await Promise.all([
    pool.query("SELECT id, title, done FROM subtasks WHERE task_id = $1 ORDER BY id", [task.id]),
    pool.query(
      `SELECT h.id, h.action, h.detail, h.created_at, u.name AS user_name
       FROM task_history h LEFT JOIN users u ON u.id = h.user_id
       WHERE h.task_id = $1 ORDER BY h.created_at DESC, h.id DESC`,
      [task.id]
    )
  ]);
  res.json({ ...task, subtasks: subtasks.rows, history: history.rows });
}));

async function validateTask(body) {
  const title = text(body.title);
  const description = text(body.description);
  // RN-002, RN-004: título, descripción, responsable y fecha de vencimiento obligatorios
  if (!title) throw new HttpError(400, "El título es obligatorio.");
  if (title.length > 200) throw new HttpError(400, "El título no puede superar 200 caracteres.");
  if (!description) throw new HttpError(400, "La descripción es obligatoria.");
  if (!isDate(body.due_date)) throw new HttpError(400, "La fecha de vencimiento es obligatoria.");
  if (body.start_date && !isDate(body.start_date)) throw new HttpError(400, "La fecha de inicio no es válida.");
  if (body.start_date && body.due_date < body.start_date) {
    throw new HttpError(400, "La fecha de vencimiento no puede ser anterior a la de inicio.");
  }
  const assigneeIds = Array.isArray(body.assignee_ids)
    ? [...new Set(body.assignee_ids.map(Number).filter(Number.isInteger))]
    : [];
  if (!assigneeIds.length) throw new HttpError(400, "Asigna al menos un responsable.");
  const active = await pool.query("SELECT id FROM users WHERE id = ANY($1::int[]) AND active", [assigneeIds]);
  if (active.rowCount !== assigneeIds.length) throw new HttpError(400, "Algún responsable no existe o está inactivo.");

  const priority = body.priority_id || "media";
  const pr = await pool.query("SELECT 1 FROM priorities WHERE id = $1", [priority]);
  if (!pr.rowCount) throw new HttpError(400, "Prioridad no válida.");

  const hours = (v, label) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 9999) throw new HttpError(400, `${label} no es válido.`);
    return n;
  };
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((t) => text(String(t)).toLowerCase()).filter(Boolean))].slice(0, 10)
    : [];

  return {
    title, description, priority_id: priority,
    start_date: body.start_date || null, due_date: body.due_date,
    estimated_hours: hours(body.estimated_hours, "El tiempo estimado"),
    actual_hours: hours(body.actual_hours, "El tiempo real"),
    tags, assigneeIds
  };
}

async function saveAssignees(db, taskId, projectId, ids) {
  await db.query("DELETE FROM task_assignees WHERE task_id = $1", [taskId]);
  await db.query("INSERT INTO task_assignees (task_id, user_id) SELECT $1, unnest($2::int[])", [taskId, ids]);
  // Los responsables quedan como participantes del proyecto
  await db.query(
    "INSERT INTO project_members (project_id, user_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING",
    [projectId, ids]
  );
}

async function names(ids) {
  const { rows } = await pool.query("SELECT name FROM users WHERE id = ANY($1::int[]) ORDER BY name", [ids]);
  return rows.map((r) => r.name).join(", ");
}

// RF-030 a RF-035, RF-041, RF-042: crear tarea
router.post("/", ah(async (req, res) => {
  // RN-003: toda tarea pertenece a un proyecto
  const projectId = Number(req.body.project_id);
  const project = Number.isInteger(projectId) ? await P.getProject(projectId) : null;
  if (!project) throw new HttpError(400, "Selecciona el proyecto de la tarea.");
  if (!P.canManageProject(req.user, project)) {
    throw new HttpError(403, "Solo el líder del proyecto o un administrador pueden crear tareas en él.");
  }
  // RN-011: un proyecto archivado no recibe tareas, salvo autorización del administrador
  if (project.archived && !P.isAdmin(req.user)) {
    throw new HttpError(400, "El proyecto está archivado y no puede recibir nuevas tareas.");
  }
  const d = await validateTask(req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO tasks (project_id, title, description, priority_id, start_date, due_date,
                          estimated_hours, actual_hours, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [projectId, d.title, d.description, d.priority_id, d.start_date, d.due_date,
       d.estimated_hours, d.actual_hours, d.tags, req.user.id]
    );
    const id = rows[0].id;
    await saveAssignees(client, id, projectId, d.assigneeIds);
    await logHistory(client, id, req.user.id, "creada", "Tarea creada");
    await logHistory(client, id, req.user.id, "asignada", `Responsables: ${await names(d.assigneeIds)}`);
    await client.query("COMMIT");
    res.status(201).json(withPermissions(req.user, await loadTask(id)));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// RF-038: editar tarea (líder del proyecto o administrador)
router.put("/:id", ah(async (req, res) => {
  const { task, project } = await loadTaskForUser(req.user, idParam(req.params.id));
  if (!task.can_manage) throw new HttpError(403, "Solo el líder del proyecto o un administrador pueden editar la tarea.");
  const d = await validateTask(req.body);

  const changes = [];
  if (d.title !== task.title) changes.push(`Título: «${task.title}» → «${d.title}»`);
  if (d.description !== task.description) changes.push("Descripción actualizada");
  if (d.priority_id !== task.priority_id) changes.push(`Prioridad: ${task.priority_id} → ${d.priority_id}`);
  if (d.due_date !== task.due_date) changes.push(`Vencimiento: ${task.due_date} → ${d.due_date}`);
  if ((d.start_date || null) !== (task.start_date || null)) changes.push(`Inicio: ${task.start_date || "sin fecha"} → ${d.start_date || "sin fecha"}`);
  if (d.estimated_hours !== task.estimated_hours) changes.push(`Tiempo estimado: ${task.estimated_hours ?? "—"} h → ${d.estimated_hours ?? "—"} h`);
  if (d.actual_hours !== task.actual_hours) changes.push(`Tiempo real: ${task.actual_hours ?? "—"} h → ${d.actual_hours ?? "—"} h`);
  if (d.tags.join(",") !== (task.tags || []).join(",")) changes.push(`Etiquetas: ${d.tags.join(", ") || "ninguna"}`);
  const before = task.assignees.map((a) => a.id).sort().join(",");
  const after = [...d.assigneeIds].sort().join(",");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE tasks SET title=$1, description=$2, priority_id=$3, start_date=$4, due_date=$5,
              estimated_hours=$6, actual_hours=$7, tags=$8, updated_at=NOW() WHERE id=$9`,
      [d.title, d.description, d.priority_id, d.start_date, d.due_date,
       d.estimated_hours, d.actual_hours, d.tags, task.id]
    );
    if (before !== after) {
      await saveAssignees(client, task.id, project.id, d.assigneeIds);
      await logHistory(client, task.id, req.user.id, "asignada", `Responsables: ${await names(d.assigneeIds)}`);
    }
    if (changes.length) await logHistory(client, task.id, req.user.id, "editada", changes.join(" · "));
    await client.query("COMMIT");
    res.json(withPermissions(req.user, await loadTask(task.id)));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// RF-047, RF-048, RF-055: cambiar el estado (al mover la tarjeta en el Kanban)
router.patch("/:id/status", ah(async (req, res) => {
  const { task, project } = await loadTaskForUser(req.user, idParam(req.params.id));
  const next = req.body.status_id;
  if (!STATUS_NAMES[next]) throw new HttpError(400, "Estado no válido.");
  if (!task.can_work) throw new HttpError(403, "Solo los responsables de la tarea o su líder pueden cambiar el estado.");
  if (next === task.status_id) return res.json(task);

  if (!task.can_manage) {
    if (["finalizada", "cancelada"].includes(task.status_id)) {
      throw new HttpError(403, "La tarea ya está cerrada. Solo el líder puede reabrirla.");
    }
    if (next === "cancelada") throw new HttpError(403, "Solo el líder puede cancelar una tarea.");
    // RN-007: si el proyecto exige aprobación, el colaborador la envía a revisión
    if (next === "finalizada" && project.requires_approval) {
      throw new HttpError(403, "Este proyecto requiere aprobación: mueve la tarea a «En revisión» para que el líder la apruebe.");
    }
  }

  await pool.query("UPDATE tasks SET status_id = $1, updated_at = NOW() WHERE id = $2", [next, task.id]);
  await logHistory(pool, task.id, req.user.id, "estado", `${STATUS_NAMES[task.status_id]} → ${STATUS_NAMES[next]}`);
  res.json(withPermissions(req.user, await loadTask(task.id)));
}));

// RF-043: registrar el tiempo real (también lo pueden hacer los responsables)
router.patch("/:id/time", ah(async (req, res) => {
  const { task } = await loadTaskForUser(req.user, idParam(req.params.id));
  if (!task.can_work) throw new HttpError(403, "No puedes registrar tiempo en esta tarea.");
  const n = Number(req.body.actual_hours);
  if (!Number.isFinite(n) || n < 0 || n > 9999) throw new HttpError(400, "El tiempo real no es válido.");
  await pool.query("UPDATE tasks SET actual_hours = $1, updated_at = NOW() WHERE id = $2", [n, task.id]);
  await logHistory(pool, task.id, req.user.id, "tiempo", `Tiempo real: ${task.actual_hours ?? "—"} h → ${n} h`);
  res.json(withPermissions(req.user, await loadTask(task.id)));
}));

// RF-058, RF-059: el líder aprueba o rechaza una tarea en revisión
router.post("/:id/review", ah(async (req, res) => {
  const { task } = await loadTaskForUser(req.user, idParam(req.params.id));
  if (!task.can_manage) throw new HttpError(403, "Solo el líder del proyecto puede aprobar o rechazar tareas.");
  if (task.status_id !== "en_revision") throw new HttpError(400, "La tarea no está en revisión.");
  const approve = req.body.decision === "aprobar";
  const note = text(req.body.note);
  if (!approve && !note) throw new HttpError(400, "Escribe las observaciones del rechazo.");

  const next = approve ? "finalizada" : "en_progreso";
  await pool.query("UPDATE tasks SET status_id = $1, updated_at = NOW() WHERE id = $2", [next, task.id]);
  await logHistory(
    pool, task.id, req.user.id,
    approve ? "aprobada" : "rechazada",
    approve ? `Aprobada${note ? `: ${note}` : ""}` : `Rechazada: ${note}`
  );
  res.json(withPermissions(req.user, await loadTask(task.id)));
}));

// RF-040: duplicar tarea
router.post("/:id/duplicate", ah(async (req, res) => {
  const { task, project } = await loadTaskForUser(req.user, idParam(req.params.id));
  if (!task.can_manage) throw new HttpError(403, "Solo el líder del proyecto o un administrador pueden duplicar tareas.");
  if (project.archived && !P.isAdmin(req.user)) throw new HttpError(400, "El proyecto está archivado.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO tasks (project_id, title, description, priority_id, start_date, due_date, estimated_hours, tags, created_by)
       SELECT project_id, LEFT(title || ' (copia)', 200), description, priority_id, start_date, due_date, estimated_hours, tags, $2
       FROM tasks WHERE id = $1 RETURNING id`,
      [task.id, req.user.id]
    );
    const id = rows[0].id;
    await client.query("INSERT INTO task_assignees (task_id, user_id) SELECT $1, user_id FROM task_assignees WHERE task_id = $2", [id, task.id]);
    await client.query("INSERT INTO subtasks (task_id, title) SELECT $1, title FROM subtasks WHERE task_id = $2 ORDER BY id", [id, task.id]);
    await logHistory(client, id, req.user.id, "creada", `Duplicada a partir de la tarea #${task.id}`);
    await client.query("COMMIT");
    res.status(201).json(withPermissions(req.user, await loadTask(id)));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// RF-039: archivar o restaurar
router.patch("/:id/archive", ah(async (req, res) => {
  const { task } = await loadTaskForUser(req.user, idParam(req.params.id));
  if (!task.can_manage) throw new HttpError(403, "Solo el líder del proyecto o un administrador pueden archivar tareas.");
  const archived = req.body.archived !== false;
  await pool.query("UPDATE tasks SET archived = $1, updated_at = NOW() WHERE id = $2", [archived, task.id]);
  await logHistory(pool, task.id, req.user.id, archived ? "archivada" : "restaurada", archived ? "Tarea archivada" : "Tarea restaurada");
  res.json({ id: task.id, archived });
}));

// RF-039: eliminar (solo administradores). RN-009: una tarea cancelada conserva su historial.
router.delete("/:id", ah(async (req, res) => {
  const { task } = await loadTaskForUser(req.user, idParam(req.params.id));
  if (!P.isAdmin(req.user)) throw new HttpError(403, "Solo un administrador puede eliminar tareas. Puedes archivarla.");
  if (task.status_id === "cancelada") throw new HttpError(400, "Las tareas canceladas conservan su historial: archívala en lugar de eliminarla.");
  await pool.query("DELETE FROM tasks WHERE id = $1", [task.id]);
  res.status(204).end();
}));

// RF-036: subtareas
router.post("/:id/subtasks", ah(async (req, res) => {
  const { task } = await loadTaskForUser(req.user, idParam(req.params.id));
  if (!task.can_work) throw new HttpError(403, "No puedes modificar esta tarea.");
  const title = text(req.body.title);
  if (!title) throw new HttpError(400, "Escribe el nombre de la subtarea.");
  const { rows } = await pool.query(
    "INSERT INTO subtasks (task_id, title) VALUES ($1, $2) RETURNING id, title, done",
    [task.id, title.slice(0, 200)]
  );
  await logHistory(pool, task.id, req.user.id, "subtarea", `Subtarea agregada: ${title}`);
  res.status(201).json(rows[0]);
}));

router.patch("/:id/subtasks/:subId", ah(async (req, res) => {
  const { task } = await loadTaskForUser(req.user, idParam(req.params.id));
  if (!task.can_work) throw new HttpError(403, "No puedes modificar esta tarea.");
  const done = req.body.done === true;
  const { rows } = await pool.query(
    "UPDATE subtasks SET done = $1 WHERE id = $2 AND task_id = $3 RETURNING id, title, done",
    [done, idParam(req.params.subId), task.id]
  );
  if (!rows[0]) throw new HttpError(404, "Subtarea no encontrada.");
  await logHistory(pool, task.id, req.user.id, "subtarea", `${done ? "Completó" : "Reabrió"} la subtarea: ${rows[0].title}`);
  res.json(rows[0]);
}));

router.delete("/:id/subtasks/:subId", ah(async (req, res) => {
  const { task } = await loadTaskForUser(req.user, idParam(req.params.id));
  if (!task.can_manage) throw new HttpError(403, "Solo el líder puede eliminar subtareas.");
  const { rows } = await pool.query(
    "DELETE FROM subtasks WHERE id = $1 AND task_id = $2 RETURNING title",
    [idParam(req.params.subId), task.id]
  );
  if (!rows[0]) throw new HttpError(404, "Subtarea no encontrada.");
  await logHistory(pool, task.id, req.user.id, "subtarea", `Subtarea eliminada: ${rows[0].title}`);
  res.status(204).end();
}));

module.exports = router;
