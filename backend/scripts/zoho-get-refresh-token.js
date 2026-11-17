// Se ejecuta UNA vez en tu equipo para obtener el refresh token que va en Render.
// Uso (PowerShell):
//   $env:ZOHO_CLIENT_ID="..."; $env:ZOHO_CLIENT_SECRET="..."; $env:ZOHO_CODE="..."; $env:ZOHO_DC="com"
//   node scripts/zoho-get-refresh-token.js
// El código se genera en api-console.zoho.com > Self Client > Generate Code,
// con los permisos ZohoMail.accounts.READ,ZohoMail.messages.CREATE (dura 10 minutos y sirve una vez).

const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_CODE, ZOHO_DC = "com" } = process.env;

(async () => {
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_CODE) {
    console.error("Faltan ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET o ZOHO_CODE.");
    process.exit(1);
  }
  const res = await fetch(`https://accounts.zoho.${ZOHO_DC}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      code: ZOHO_CODE
    })
  });
  const data = await res.json();
  if (!data.refresh_token) {
    console.error("Zoho respondió sin refresh token:", { ...data, access_token: undefined });
    process.exit(1);
  }
  console.log("\nGuarda este valor como ZOHO_REFRESH_TOKEN en Render (no lo subas a GitHub ni lo compartas):\n");
  console.log(data.refresh_token, "\n");
})();
