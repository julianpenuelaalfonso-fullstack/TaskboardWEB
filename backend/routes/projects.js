const express = require("express");
const pool = require("../db");
const { ah, HttpError, isDate, text, idParam } = require("../lib/http");
const P = require("../lib/permissions");

const router = express.Router();

// Progreso = tareas finalizadas / tareas no canceladas ni archivadas (RF-027)
const PROJECT_SELECT = `
  SELECT p.*, l.name AS leader_name, d.name AS department_name, pr.name AS priority_name,
    COALESCE(s.total, 0) AS task_count,
    COALESCE(s.done, 0) AS done_count,
    COALESCE(s.overdue, 0) AS overdue_count,
    CASE WHEN COALESCE(s.total, 0) = 0 THEN 0 ELSE ROUND(100.0 * s.done / s.total)::int END AS progress,
    (SELECT COUNT(*)::int FROM project_members m WHERE m.project_id = p.id) AS member_count
  FROM projects p
  JOIN users l ON l.id = p.leader_id
  JOIN priorities pr ON pr.id = p.priority_id
  LEFT JOIN departments d ON d.id = p.department_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE t.status_id = 'finalizada')::int AS done,
           COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status_id NOT IN ('finalizada','cancelada'))::int AS overdue
    FROM tasks t WHERE t.project_id = p.id AND NOT t.archived AND t.status_id <> 'cancelada'
  ) s ON true`;

// RF-029: proyectos visibles para el usuario, filtrables por departamento
router.get("/", ah(async (req, res) => {
  const params = [];
  const where = [];
  if (!P.canViewAll(req.user)) {
    params.push(req.user.id);
    where.push(`(p.leader_id = $${params.length} OR EXISTS (
      SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = $${params.length}))`);
  }
  if (req.query.department_id) {
    params.push(Number(req.query.department_id));
    where.push(`p.department_id = $${params.length}`);
  }
  where.push(req.query.archived === "true" ? "p.archived" : "NOT p.archived");
  const { rows } = await pool.query(
    `${PROJECT_SELECT} WHERE ${where.join(" AND ")} ORDER BY p.end_date NULLS LAST, p.name`,
    params
  );
  res.json(rows.map((p) => ({ ...p, can_manage: P.canManageProject(req.user, p) })));
}));

router.get("/:id", ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await pool.query(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
  const project = rows[0];
  if (!project) throw new HttpError(404, "Proyecto no encontrado.");
  if (!(await P.canViewProject(req.user, project))) throw new HttpError(403, "No tienes acceso a este proyecto.");
  const members = await pool.query(
    `SELECT u.id, u.name, u.position, u.role_id FROM project_members m
     JOIN users u ON u.id = m.user_id WHERE m.project_id = $1 ORDER BY u.name`,
    [id]
  );
  res.json({ ...project, members: members.rows, can_manage: P.canManageProject(req.user, project) });
}));

async function validate(req, body) {
  const name = text(body.name);
  if (!name) throw new HttpError(400, "El nombre del proyecto es obligatorio.");
  if (body.start_date && !isDate(body.start_date)) throw new HttpError(400, "La fecha de inicio no es válida.");
  if (body.end_date && !isDate(body.end_date)) throw new HttpError(400, "La fecha de finalización no es válida.");
  if (body.start_date && body.end_date && body.end_date < body.start_date) {
    throw new HttpError(400, "La fecha de finalización no puede ser anterior a la de inicio.");
  }
  const priority = body.priority_id || "media";
  const pr = await pool.query("SELECT 1 FROM priorities WHERE id = $1", [priority]);
  if (!pr.rowCount) throw new HttpError(400, "Prioridad no válida.");

  // Un líder solo puede crear proyectos que él mismo lidera; el administrador elige el líder (RF-022)
  const leaderId = P.isAdmin(req.user) ? Number(body.leader_id) : req.user.id;
  const leader = await pool.query("SELECT role_id, active FROM users WHERE id = $1", [leaderId]);
  if (!leader.rowCount || !leader.rows[0].active) throw new HttpError(400, "Selecciona un líder válido.");

  const memberIds = Array.isArray(body.member_ids)
    ? [...new Set(body.member_ids.map(Number).filter((n) => Number.isInteger(n) && n !== leaderId))]
    : [];

  return {
    name,
    description: text(body.description) || null,
    objectives: text(body.objectives) || null,
    department_id: body.department_id ? Number(body.department_id) : null,
    leader_id: leaderId,
    priority_id: priority,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    requires_approval: body.requires_approval !== false,
    memberIds
  };
}

async function saveMembers(client, projectId, memberIds) {
  await client.query("DELETE FROM project_members WHERE project_id = $1", [projectId]);
  if (memberIds.length) {
    await client.query(
      "INSERT INTO project_members (project_id, user_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING",
      [projectId, memberIds]
    );
  }
}

// RF-021 a RF-026: crear proyecto
router.post("/", ah(async (req, res) => {
  if (!P.canCreateProject(req.user)) throw new HttpError(403, "No tienes permiso para crear proyectos.");
  const d = await validate(req, req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO projects (name, description, objectives, department_id, leader_id, priority_id,
                             start_date, end_date, requires_approval, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [d.name, d.description, d.objectives, d.department_id, d.leader_id, d.priority_id,
       d.start_date, d.end_date, d.requires_approval, req.user.id]
    );
    await saveMembers(client, rows[0].id, d.memberIds);
    await client.query("COMMIT");
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// RF-028: editar proyecto
router.put("/:id", ah(async (req, res) => {
  const id = idParam(req.params.id);
  const project = await P.getProject(id);
  if (!project) throw new HttpError(404, "Proyecto no encontrado.");
  if (!P.canManageProject(req.user, project)) throw new HttpError(403, "Solo el líder del proyecto o un administrador pueden editarlo.");
  const d = await validate(req, { ...req.body, leader_id: req.body.leader_id ?? project.leader_id });
  if (!P.isAdmin(req.user)) d.leader_id = project.leader_id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE projects SET name=$1, description=$2, objectives=$3, department_id=$4, leader_id=$5,
              priority_id=$6, start_date=$7, end_date=$8, requires_approval=$9, updated_at=NOW()
       WHERE id=$10`,
      [d.name, d.description, d.objectives, d.department_id, d.leader_id, d.priority_id,
       d.start_date, d.end_date, d.requires_approval, id]
    );
    await saveMembers(client, id, d.memberIds);
    await client.query("COMMIT");
    res.json({ id });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// RF-028: archivar o restaurar proyecto
router.patch("/:id/archive", ah(async (req, res) => {
  const id = idParam(req.params.id);
  const project = await P.getProject(id);
  if (!project) throw new HttpError(404, "Proyecto no encontrado.");
  if (!P.canManageProject(req.user, project)) throw new HttpError(403, "Solo el líder del proyecto o un administrador pueden archivarlo.");
  const archived = req.body.archived !== false;
  await pool.query("UPDATE projects SET archived = $1, updated_at = NOW() WHERE id = $2", [archived, id]);
  res.json({ id, archived });
}));

module.exports = router;
