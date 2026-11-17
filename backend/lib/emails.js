// Plantillas de correo (HTML con estilos en línea para que se vean bien en Gmail, Outlook y Zoho)
const pool = require("../db");
const { sendInBackground } = require("./mailer");

const PRIORITY = { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" };
const PRIORITY_COLOR = { baja: "#5f6b65", media: "#3f7cc4", alta: "#c46a1f", urgente: "#c2372b" };

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Primera URL de FRONTEND_URL (puede traer varias separadas por comas)
const appUrl = () => (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");

function formatDate(value) {
  if (!value) return "Sin fecha";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

function layout({ preheader, title, body, button }) {
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f4f2ec;font-family:Segoe UI,Arial,sans-serif;color:#1c2420">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#15322b;padding:18px 24px;font-size:20px;font-weight:800;color:#e8f0ec">Task<span style="color:#c6ef5e">Board</span></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#15322b">${title}</h1>
${body}
${button ? `<p style="margin:24px 0 8px"><a href="${esc(button.href)}" style="display:inline-block;background:#15322b;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${esc(button.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:14px 24px;background:#faf9f5;color:#7b8680;font-size:12px">Este es un mensaje automático de TaskBoard. No respondas a este correo.</td></tr>
</table></td></tr></table></body></html>`;
}

function row(label, value) {
  return `<tr><td style="padding:6px 12px 6px 0;color:#5f6b65;font-size:13px;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;font-size:14px;font-weight:600">${value}</td></tr>`;
}

// RF-073: aviso de tarea asignada a cada responsable nuevo
async function notifyTaskAssigned(taskId, recipientIds, assignedBy) {
  const ids = recipientIds.filter((id) => id !== assignedBy.id);
  if (!ids.length) return;
  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.description, t.priority_id, t.start_date, t.due_date, t.estimated_hours,
            p.name AS project_name,
            (SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM task_assignees a JOIN users u ON u.id = a.user_id WHERE a.task_id = t.id) AS assignees
     FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = $1`,
    [taskId]
  );
  const task = rows[0];
  if (!task) return;
  const people = await pool.query("SELECT id, name, email FROM users WHERE id = ANY($1::int[]) AND active", [ids]);

  const link = `${appUrl()}/#/tablero?tarea=${task.id}`;
  const prio = `<span style="color:${PRIORITY_COLOR[task.priority_id]}">${PRIORITY[task.priority_id] || task.priority_id}</span>`;
  const details = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid #e4e1d8;border-bottom:1px solid #e4e1d8;width:100%">
${row("Proyecto", esc(task.project_name))}
${row("Prioridad", prio)}
${row("Inicio", esc(formatDate(task.start_date)))}
${row("Vencimiento", esc(formatDate(task.due_date)))}
${task.estimated_hours != null ? row("Tiempo estimado", `${esc(task.estimated_hours)} h`) : ""}
${row("Responsables", esc(task.assignees))}
${row("Asignada por", esc(assignedBy.name))}
</table>`;

  for (const person of people.rows) {
    const html = layout({
      preheader: `${assignedBy.name} te asignó «${task.title}»`,
      title: `Tienes una tarea nueva: ${esc(task.title)}`,
      body: `<p style="margin:0 0 4px;font-size:15px">Hola ${esc(person.name.split(" ")[0])}, ${esc(assignedBy.name)} te asignó esta tarea.</p>
${details}
<p style="margin:0 0 4px;color:#5f6b65;font-size:13px;font-weight:700">Descripción</p>
<p style="margin:0;font-size:14px;line-height:1.5;white-space:pre-line">${esc(task.description)}</p>`,
      button: { href: link, label: "Ver tarea en TaskBoard" }
    });
    sendInBackground({ to: person.email, subject: `Nueva tarea: ${task.title}`, html }, `tarea #${task.id}`);
  }
}

// RF-006: correo de recuperación de contraseña
function passwordResetEmail(link) {
  return layout({
    preheader: "Crea una contraseña nueva para TaskBoard",
    title: "Recupera tu contraseña",
    body: `<p style="margin:0 0 8px;font-size:15px">Recibimos una solicitud para restablecer tu contraseña en TaskBoard.</p>
<p style="margin:0;font-size:14px;color:#5f6b65">El enlace vence en 1 hora y solo se puede usar una vez. Si no lo pediste, ignora este mensaje.</p>`,
    button: { href: link, label: "Crear una contraseña nueva" }
  });
}

module.exports = { notifyTaskAssigned, passwordResetEmail };
