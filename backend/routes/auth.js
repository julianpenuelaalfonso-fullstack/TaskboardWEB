const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { signToken, requireAuth } = require("../middleware/auth");
const { permissionsFor } = require("../lib/permissions");
const { ah, HttpError, text } = require("../lib/http");
const { sendInBackground } = require("../lib/mailer");
const { passwordResetEmail } = require("../lib/emails");
const { createLink, findValidLink } = require("../lib/invitations");

const router = express.Router();

const USER_FIELDS = `u.id, u.name, u.email, u.role_id, r.name AS role_name, u.department_id,
  d.name AS department_name, u.position, u.phone, u.active, u.password_set`;

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
// Envía el enlace por correo (Zoho Mail). Si el correo no está configurado, se escribe en los logs.
router.post("/forgot", ah(async (req, res) => {
  const email = text(req.body.email).toLowerCase();
  const { rows } = await pool.query("SELECT id, active FROM users WHERE email = $1", [email]);
  const user = rows[0];
  const response = { message: "Si el correo está registrado, recibirás instrucciones para restablecer la contraseña." };

  if (user && user.active) {
    const link = await createLink(user.id, "reset");
    // En segundo plano: la respuesta tarda lo mismo exista o no la cuenta
    sendInBackground({ to: email, subject: "Recupera tu contraseña de TaskBoard", html: passwordResetEmail(link) }, "recuperación");
    // Solo en desarrollo se devuelve el enlace para poder probar sin correo
    if (process.env.NODE_ENV !== "production") response.devResetLink = link;
  }
  res.json(response);
}));

// Datos del enlace (para saludar por nombre en «Activa tu cuenta» o «Crea una contraseña nueva»)
router.get("/link/:token", ah(async (req, res) => {
  const link = await findValidLink(req.params.token);
  if (!link) throw new HttpError(404, "El enlace venció o ya fue usado.");
  res.json({ kind: link.kind, name: link.name, email: link.email });
}));

// RF-006 e invitaciones: crear la contraseña con el enlace. Al terminar, la persona queda con la sesión iniciada.
router.post("/reset", ah(async (req, res) => {
  const { token, password } = req.body;
  const link = await findValidLink(token);
  if (!link) throw new HttpError(400, "El enlace venció o ya fue usado. Pide uno nuevo.");
  validatePassword(password);
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    "UPDATE users SET password_hash = $1, password_set = true, updated_at = NOW() WHERE id = $2",
    [hash, link.user_id]
  );
  // El enlace y cualquier otro pendiente de la misma persona dejan de servir
  await pool.query("UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false", [link.user_id]);

  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [link.user_id]);
  res.json({
    message: link.kind === "invite" ? "Tu cuenta quedó activa. ¡Bienvenido!" : "Contraseña actualizada.",
    token: signToken(rows[0]),
    user: await loadProfile(link.user_id),
    permissions: permissionsFor(rows[0])
  });
}));

module.exports = { router, validatePassword, loadProfile };
