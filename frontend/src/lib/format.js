// Utilidades de formato compartidas

export const STATUS_ORDER = ["pendiente", "por_iniciar", "en_progreso", "en_revision", "en_espera", "finalizada", "cancelada"];

export const PRIORITY_LABEL = { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" };

export function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// "2026-11-10" → Date local (sin desfase de zona horaria)
export function parseDate(value) {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDate(value, opts = { day: "numeric", month: "short" }) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString("es-CO", opts) : "—";
}

// Texto corto del vencimiento: "Vence hoy", "Venció hace 2 días", "En 5 días"
export function dueLabel(value, closed) {
  const d = parseDate(value);
  if (!d) return "";
  const today = parseDate(todayISO());
  const days = Math.round((d - today) / 86400000);
  if (closed) return formatDate(value);
  if (days < -1) return `Venció hace ${-days} días`;
  if (days === -1) return "Venció ayer";
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  if (days <= 7) return `En ${days} días`;
  return formatDate(value);
}

export function formatDateTime(value) {
  return new Date(value).toLocaleString("es-CO", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit"
  });
}
