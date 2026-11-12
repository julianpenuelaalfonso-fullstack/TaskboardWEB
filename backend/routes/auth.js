const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { signToken, requireAuth } = require("../middleware/auth");
const { permissionsFor } = require("../lib/permissions");
const { ah, HttpError, text } = require("../lib/http");

const router = express.Router();

const USER_FIELDS = `u.id, u.name, u.email, u.role_id, r.name AS role_name, u.department_id,
  d.name AS department_name, u.position, u.phone, u.active`;

async function loadProfile(id) {
  const { rows } = await pool.query(
    `SELECT ${USER_FIELDS} FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1`,
    [id]
  );
  return rows[0];
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres, con letras y números.");
  }
}

// RF-001: iniciar sesión con correo y contraseña
router.post("/login", ah(async (req, res) => {
  const email = text(req.body.email).toLowerCase();
  const password = req.body.password || "";
  if (!email || !password) throw new HttpError(400, "Escribe tu correo y tu contraseña.");

  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];
  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) throw new HttpError(401, "Correo o contraseña incorrectos.");
  if (!user.active) throw new HttpError(403, "Tu cuenta está desactivada. Contacta al administrador.");

  const profile = await loadProfile(user.id);
  res.json({ token: signToken(user), user: profile, permissions: permissionsFor(user) });
}));

// Usuario actual (se usa al recargar la página)
router.get("/me", requireAuth, ah(async (req, res) => {
  res.json({ user: await loadProfile(req.user.id), permissions: permissionsFor(req.user) });
}));

// RF-009: actualizar el perfil propio
router.put("/me", requireAuth, ah(async (req, res) => {
  const name = text(req.body.name);
  if (!name) throw new HttpError(400, "El nombre es obligatorio.");
  await pool.query(
    "UPDATE users SET name = $1, phone = $2, position = $3, updated_at = NOW() WHERE id = $4",
    [name, text(req.body.phone) || null, text(req.body.position) || null, req.user.id]
  );
  res.json({ user: await loadProfile(req.user.id) });
}));

// Cambiar la contraseña propia
router.put("/me/password", requireAuth, ah(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { rows } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
  if (!(await bcrypt.compare(currentPassword || "", rows[0].password_hash))) {
    throw new HttpError(400, "La contraseña actual no es correcta.");
  }
  validatePassword(newPassword);
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hash, req.user.id]);
  res.json({ ok: true });
}));

// RF-006: solicitar recuperación de contraseña.
// Sin servicio de correo, el enlace se escribe en los logs del servidor (simula el correo).
router.post("/forgot", ah(async (req, res) => {
  const email = text(req.body.email).toLowerCase();
  const { rows } = await pool.query("SELECT id, active FROM users WHERE email = $1", [email]);
  const user = rows[0];
  const response = { message: "Si el correo está registrado, recibirás instrucciones para restablecer la contraseña." };

  if (user && user.active) {
    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query(
      "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')",
      [user.id, tokenHash]
    );
    const link = `${process.env.FRONTEND_URL || "http://localhost:5173"}/?reset=${token}`;
    console.log(`[Recuperación de contraseña] ${email}: ${link}`);
    // Solo en desarrollo se devuelve el enlace para poder probar sin correo
    if (process.env.NODE_ENV !== "production") response.devResetLink = link;
  }
  res.json(response);
}));

// RF-006: restablecer la contraseña con el token
router.post("/reset", ah(async (req, res) => {
  const { token, password } = req.body;
  if (!token) throw new HttpError(400, "El enlace de recuperación no es válido.");
  validatePassword(password);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const { rows } = await pool.query(
    "SELECT * FROM password_resets WHERE token_hash = $1 AND used = false AND expires_at > NOW()",
    [tokenHash]
  );
  if (!rows[0]) throw new HttpError(400, "El enlace venció o ya fue usado. Solicita uno nuevo.");
  const hash = await bcrypt.hash(password, 10);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hash, rows[0].user_id]);
  await pool.query("UPDATE password_resets SET used = true WHERE id = $1", [rows[0].id]);
  res.json({ message: "Contraseña actualizada. Ya puedes iniciar sesión." });
}));

module.exports = { router, validatePassword, loadProfile };
