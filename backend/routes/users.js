const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");
const { ah, HttpError, isEmail, text, idParam } = require("../lib/http");
const { validatePassword, loadProfile } = require("./auth");

const router = express.Router();
const ADMIN = requireRole("superadmin", "admin");

// Lista de empleados. Todos los usuarios autenticados la ven (para asignar y mostrar responsables);
// el correo y teléfono solo los ven los administradores.
router.get("/", ah(async (req, res) => {
  const admin = ["superadmin", "admin"].includes(req.user.role_id);
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.role_id, r.name AS role_name, u.department_id, d.name AS department_name,
            u.position, u.active ${admin ? ", u.email, u.phone, u.created_at" : ""}
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     ${admin ? "" : "WHERE u.active = true"}
     ORDER BY u.name`
  );
  res.json(rows);
}));

async function validateUserBody(body, { requirePassword }) {
  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  if (!name) throw new HttpError(400, "El nombre es obligatorio.");
  if (!isEmail(email)) throw new HttpError(400, "Escribe un correo válido.");
  const role = await pool.query("SELECT 1 FROM roles WHERE id = $1", [body.role_id]);
  if (!role.rowCount) throw new HttpError(400, "Selecciona un rol válido.");
  if (body.department_id) {
    const dep = await pool.query("SELECT 1 FROM departments WHERE id = $1", [body.department_id]);
    if (!dep.rowCount) throw new HttpError(400, "El departamento no existe.");
  }
  if (requirePassword || body.password) validatePassword(body.password);
  return {
    name,
    email,
    role_id: body.role_id,
    department_id: body.department_id || null,
    position: text(body.position) || null,
    phone: text(body.phone) || null
  };
}

function checkRoleAssignment(req, roleId) {
  // RN-005: solo el administrador gestiona roles; solo el superadministrador crea otros superadministradores
  if (roleId === "superadmin" && req.user.role_id !== "superadmin") {
    throw new HttpError(403, "Solo un superadministrador puede asignar ese rol.");
  }
}

// RF-003, RF-007, RF-008: registrar empleado con rol y departamento
router.post("/", ADMIN, ah(async (req, res) => {
  const data = await validateUserBody(req.body, { requirePassword: true });
  checkRoleAssignment(req, data.role_id);
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id, department_id, position, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [data.name, data.email, hash, data.role_id, data.department_id, data.position, data.phone]
    );
    res.status(201).json(await loadProfile(rows[0].id));
  } catch (err) {
    if (err.code === "23505") throw new HttpError(409, "Ya existe un usuario con ese correo."); // RNF-009
    throw err;
  }
}));

// RF-004: editar empleado
router.put("/:id", ADMIN, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const data = await validateUserBody(req.body, { requirePassword: false });
  checkRoleAssignment(req, data.role_id);
  if (id === req.user.id && data.role_id !== req.user.role_id) {
    throw new HttpError(400, "No puedes cambiar tu propio rol.");
  }
  try {
    const { rowCount } = await pool.query(
      `UPDATE users SET name = $1, email = $2, role_id = $3, department_id = $4, position = $5,
              phone = $6, updated_at = NOW() WHERE id = $7`,
      [data.name, data.email, data.role_id, data.department_id, data.position, data.phone, id]
    );
    if (!rowCount) throw new HttpError(404, "Usuario no encontrado.");
  } catch (err) {
    if (err.code === "23505") throw new HttpError(409, "Ya existe un usuario con ese correo.");
    throw err;
  }
  if (req.body.password) {
    const hash = await bcrypt.hash(req.body.password, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, id]);
  }
  res.json(await loadProfile(id));
}));

// RF-005: activar o desactivar cuentas
router.patch("/:id/active", ADMIN, ah(async (req, res) => {
  const id = idParam(req.params.id);
  if (typeof req.body.active !== "boolean") throw new HttpError(400, "Indica si la cuenta queda activa o no.");
  if (id === req.user.id) throw new HttpError(400, "No puedes desactivar tu propia cuenta.");
  const { rowCount } = await pool.query(
    "UPDATE users SET active = $1, updated_at = NOW() WHERE id = $2",
    [req.body.active, id]
  );
  if (!rowCount) throw new HttpError(404, "Usuario no encontrado.");
  res.json(await loadProfile(id));
}));

module.exports = router;
