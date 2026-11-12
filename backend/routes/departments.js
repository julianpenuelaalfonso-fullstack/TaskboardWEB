const express = require("express");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");
const { ah, HttpError, text, idParam } = require("../lib/http");

const router = express.Router();
const ADMIN = requireRole("superadmin", "admin");

// Lista de departamentos con líder y número de integrantes
router.get("/", ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT d.id, d.name, d.description, d.leader_id, l.name AS leader_name,
            (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id AND u.active) AS member_count,
            (SELECT COUNT(*)::int FROM projects p WHERE p.department_id = d.id AND NOT p.archived) AS project_count
     FROM departments d
     LEFT JOIN users l ON l.id = d.leader_id
     ORDER BY d.name`
  );
  res.json(rows);
}));

// RF-020: integrantes de un departamento
router.get("/:id/members", ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.position, u.role_id, r.name AS role_name, u.active
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.department_id = $1 ORDER BY u.name`,
    [id]
  );
  res.json(rows);
}));

async function validate(body) {
  const name = text(body.name);
  if (!name) throw new HttpError(400, "El nombre del departamento es obligatorio.");
  // RF-019: cada departamento debe tener un líder responsable
  if (!body.leader_id) throw new HttpError(400, "Selecciona el líder responsable del departamento.");
  const leader = await pool.query("SELECT active FROM users WHERE id = $1", [body.leader_id]);
  if (!leader.rowCount || !leader.rows[0].active) throw new HttpError(400, "El líder seleccionado no es válido.");
  return { name, description: text(body.description) || null, leader_id: body.leader_id };
}

// RF-016: crear departamento
router.post("/", ADMIN, ah(async (req, res) => {
  const d = await validate(req.body);
  try {
    const { rows } = await pool.query(
      "INSERT INTO departments (name, description, leader_id) VALUES ($1, $2, $3) RETURNING *",
      [d.name, d.description, d.leader_id]
    );
    // El líder queda asociado al departamento
    await pool.query("UPDATE users SET department_id = $1 WHERE id = $2", [rows[0].id, d.leader_id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") throw new HttpError(409, "Ya existe un departamento con ese nombre.");
    throw err;
  }
}));

// RF-017: editar departamento
router.put("/:id", ADMIN, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const d = await validate(req.body);
  try {
    const { rows } = await pool.query(
      "UPDATE departments SET name = $1, description = $2, leader_id = $3 WHERE id = $4 RETURNING *",
      [d.name, d.description, d.leader_id, id]
    );
    if (!rows[0]) throw new HttpError(404, "Departamento no encontrado.");
    await pool.query("UPDATE users SET department_id = $1 WHERE id = $2", [id, d.leader_id]);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === "23505") throw new HttpError(409, "Ya existe un departamento con ese nombre.");
    throw err;
  }
}));

// RF-018: asignar empleados a un departamento
router.put("/:id/members", ADMIN, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const ids = Array.isArray(req.body.user_ids) ? req.body.user_ids.map(Number).filter(Number.isInteger) : [];
  await pool.query("UPDATE users SET department_id = $1 WHERE id = ANY($2::int[])", [id, ids]);
  res.json({ ok: true });
}));

module.exports = router;
