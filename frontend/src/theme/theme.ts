export type Theme = "light" | "dark" | "system";
const KEY = "taskboard-theme";

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function setTheme(t: Theme): void {
  try { localStorage.setItem(KEY, t); } catch { /* sin almacenamiento: el tema solo dura la sesión */ }
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = t;
}
