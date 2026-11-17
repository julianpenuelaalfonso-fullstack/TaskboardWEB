// Enlaces de un solo uso para invitar empleados (crear su contraseña) y para recuperar contraseñas.
// En la base solo se guarda el hash SHA-256 del token: quien lea la base no puede usar los enlaces.
const crypto = require("crypto");
const pool = require("../db");
const { sendMail } = require("./mailer");
const { inviteEmail } = require("./emails");

const INVITE_HOURS = 72;
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const appUrl = () => (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");

// Crea un enlace nuevo y anula los anteriores del mismo tipo para ese usuario
async function createLink(userId, kind) {
  const token = crypto.randomBytes(24).toString("hex");
  const hours = kind === "invite" ? INVITE_HOURS : 1;
  await pool.query("UPDATE password_resets SET used = true WHERE user_id = $1 AND kind = $2 AND used = false", [userId, kind]);
  await pool.query(
    `INSERT INTO password_resets (user_id, token_hash, kind, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(hours => $4))`,
    [userId, hashToken(token), kind, hours]
  );
  return `${appUrl()}/?${kind === "invite" ? "invite" : "reset"}=${token}`;
}

// Envía la invitación y espera la respuesta de Zoho, para que el administrador sepa si llegó.
// Devuelve { sent, link?, message }. El enlace solo se devuelve si el correo no salió (o en desarrollo),
// para que el administrador lo comparta por otro medio.
async function sendInvite(userId, invitedBy) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, r.name AS role_name, d.name AS department_name
     FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1`,
    [userId]
  );
  const user = rows[0];
  const link = await createLink(user.id, "invite");
  const html = inviteEmail({
    name: user.name,
    invitedBy: invitedBy.name,
    roleName: user.role_name,
    departmentName: user.department_name,
    link,
    hours: INVITE_HOURS
  });
  const dev = process.env.NODE_ENV !== "production";
  try {
    const r = await sendMail({ to: user.email, subject: `${invitedBy.name} te invitó a TaskBoard`, html });
    if (r.sent) {
      console.log(`[Correo enviado] ${user.email} · invitación`);
      return { sent: true, message: `Invitación enviada a ${user.email}.`, ...(dev ? { link } : {}) };
    }
    return { sent: false, link, message: "El correo no está configurado en el servidor. Copia el enlace y envíaselo por otro medio." };
  } catch (err) {
    console.error(`[Correo] No se pudo enviar la invitación a ${user.email}:`, err.message);
    return { sent: false, link, message: "No se pudo enviar el correo. Copia el enlace y envíaselo por otro medio." };
  }
}

// Busca un enlace vigente de un usuario activo
async function findValidLink(token) {
  if (!token || typeof token !== "string") return null;
  const { rows } = await pool.query(
    `SELECT pr.id, pr.user_id, pr.kind, u.name, u.email
     FROM password_resets pr JOIN users u ON u.id = pr.user_id
     WHERE pr.token_hash = $1 AND pr.used = false AND pr.expires_at > NOW() AND u.active`,
    [hashToken(token)]
  );
  return rows[0] || null;
}

module.exports = { createLink, sendInvite, findValidLink, INVITE_HOURS };
