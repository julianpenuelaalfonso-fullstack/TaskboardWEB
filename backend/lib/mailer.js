// Envío de correo con la API HTTPS de Zoho Mail.
// Render bloquea el SMTP en el plan gratis, pero la API sale por el puerto 443.
// Si faltan las variables de Zoho, no se envía nada y el mensaje se escribe en los logs (modo desarrollo).

const DC = process.env.ZOHO_DC || "com"; // com, eu, in, com.au, jp...

let cache = { token: null, expires: 0, accountId: process.env.ZOHO_ACCOUNT_ID || null };

const isConfigured = () =>
  Boolean(
    process.env.ZOHO_CLIENT_ID &&
    process.env.ZOHO_CLIENT_SECRET &&
    process.env.ZOHO_REFRESH_TOKEN &&
    process.env.MAIL_FROM
  );

// El token de acceso dura 1 hora: se guarda en memoria y se renueva solo cuando vence.
async function getAccessToken(force = false) {
  if (!force && cache.token && Date.now() < cache.expires) return cache.token;
  const res = await fetch(`https://accounts.zoho.${DC}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Zoho no entregó el token (${res.status}): ${data.error || "respuesta inesperada"}`);
  }
  const seconds = Math.min(Number(data.expires_in) || 3600, 3600);
  cache.token = data.access_token;
  cache.expires = Date.now() + (seconds - 300) * 1000; // se renueva 5 min antes
  return cache.token;
}

async function getAccountId(token) {
  if (cache.accountId) return cache.accountId;
  const res = await fetch(`https://mail.zoho.${DC}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  const id = data?.data?.[0]?.accountId;
  if (!res.ok || !id) throw new Error(`No se pudo obtener la cuenta de Zoho (${res.status}).`);
  cache.accountId = String(id);
  return cache.accountId;
}

async function post(token, accountId, payload) {
  return fetch(`https://mail.zoho.${DC}/api/accounts/${accountId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });
}

// Devuelve { sent: true } si Zoho aceptó el mensaje y { sent: false } si no está configurado.
// Lanza un Error si Zoho lo rechaza: quien llama decide qué hacer.
async function sendMail({ to, subject, html }) {
  if (!isConfigured()) {
    console.log(`[Correo no configurado] Para: ${to} · Asunto: ${subject}\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
    return { sent: false };
  }

  const payload = { fromAddress: process.env.MAIL_FROM, toAddress: to, subject, content: html, mailFormat: "html" };
  let token = await getAccessToken();
  let accountId = await getAccountId(token);
  let res = await post(token, accountId, payload);

  if (res.status === 401) {
    // Token vencido o revocado: se renueva y se reintenta una sola vez
    token = await getAccessToken(true);
    res = await post(token, accountId, payload);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zoho rechazó el correo (${res.status}): ${body.slice(0, 300)}`);
  }
  return { sent: true };
}

// Envía sin hacer esperar la respuesta HTTP: si falla, solo queda el error en los logs
function sendInBackground(message, context = "") {
  sendMail(message)
    .then((r) => r.sent && console.log(`[Correo enviado] ${message.to}${context ? ` · ${context}` : ""}`))
    .catch((err) => console.error(`[Correo] No se pudo enviar a ${message.to}${context ? ` (${context})` : ""}:`, err.message));
}

module.exports = { sendMail, sendInBackground, isConfigured };
