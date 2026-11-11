import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { ApiError } from "../api/client";
import { Sidebar } from "./Sidebar";
import "./layout.css";

const transient = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status >= 500);

// "retrying": alguna consulta reintenta tras un fallo transitorio; "failed": se agotaron los reintentos.
function useServerState() {
  const cache = useQueryClient().getQueryCache();
  return useSyncExternalStore(
    (cb) => cache.subscribe(cb),
    () => {
      const qs = cache.getAll();
      if (qs.some((q) => q.state.fetchStatus === "fetching" && q.state.fetchFailureCount > 0 && transient(q.state.fetchFailureReason))) return "retrying";
      return qs.some((q) => q.state.status === "error" && q.state.fetchStatus !== "fetching" && transient(q.state.error)) ? "failed" : "ok";
    }
  );
}

function ServerNotice() {
  const qc = useQueryClient();
  const state = useServerState();
  if (state === "ok") return null;
  if (state === "retrying") {
    return (
      <div className="alert server-notice" role="status">
        <div>
          <p>Conectando con el servidor…</p>
          <p className="muted">Si estaba en reposo, puede tardar hasta un minuto en responder.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="alert server-notice" role="alert">
      <p>No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.</p>
      <button type="button" className="alert-retry"
        onClick={() => void qc.refetchQueries({ predicate: (q) => q.state.status === "error" })}>Reintentar</button>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const side = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) side.current?.focus();
    else if (wasOpen.current) menuBtn.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="shell">
      <header className="shell-bar">
        <button ref={menuBtn} type="button" aria-expanded={open} aria-controls="shell-side" onClick={() => setOpen((o) => !o)}>Menú</button>
        <span className="side-brand">TaskBoard</span>
      </header>
      <aside id="shell-side" ref={side} tabIndex={-1} className={open ? "shell-side is-open" : "shell-side"}>
        <Sidebar onNavigate={() => setOpen(false)} />
      </aside>
      <div className="shell-main">
        <ServerNotice />
        <Outlet />
      </div>
    </div>
  );
}
