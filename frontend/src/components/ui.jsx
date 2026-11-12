import { useEffect, useRef, useState } from "react";
import { X, Search } from "lucide-react";
import { initials } from "../lib/format";

// Panel lateral (detalle y formularios). Se cierra con Escape o con el fondo.
export function Drawer({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="drawer-layer">
      <div className="drawer-backdrop" onClick={onClose} />
      <aside
        className={wide ? "drawer drawer-wide" : "drawer"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        ref={ref}
      >
        <header className="drawer-head">
          <h2 id="drawer-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor, required }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function Avatar({ name, size = "md" }) {
  // Color estable según el nombre
  const hues = [158, 95, 200, 30, 280, 340, 50];
  const hue = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ background: `hsl(${hue} 45% 88%)`, color: `hsl(${hue} 50% 24%)` }}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 3 }) {
  const shown = people.slice(0, max);
  return (
    <span className="avatar-stack" aria-label={people.map((p) => p.name).join(", ")}>
      {shown.map((p) => <Avatar key={p.id} name={p.name} size="sm" />)}
      {people.length > max && <span className="avatar avatar-sm avatar-more">+{people.length - max}</span>}
    </span>
  );
}

// Selector múltiple de personas con búsqueda
export function PeoplePicker({ id, users, value, onChange, disabled }) {
  const [q, setQ] = useState("");
  const list = users.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (uid) =>
    onChange(value.includes(uid) ? value.filter((x) => x !== uid) : [...value, uid]);
  return (
    <div className="picker" id={id}>
      <div className="picker-search">
        <Search size={16} aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar persona"
          aria-label="Buscar persona"
          disabled={disabled}
        />
      </div>
      <ul className="picker-list">
        {list.map((u) => (
          <li key={u.id}>
            <label className="picker-item">
              <input
                type="checkbox"
                checked={value.includes(u.id)}
                onChange={() => toggle(u.id)}
                disabled={disabled}
              />
              <Avatar name={u.name} size="sm" />
              <span className="picker-name">
                {u.name}
                <small>{[u.position, u.department_name].filter(Boolean).join(" · ")}</small>
              </span>
            </label>
          </li>
        ))}
        {list.length === 0 && <li className="picker-empty">Nadie coincide con «{q}».</li>}
      </ul>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p className="empty-hint">{children}</p>}
    </div>
  );
}

export function Loading({ text = "Cargando..." }) {
  return <p className="loading-line" role="status">{text}</p>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="alert" role="alert">
      <p>{message}</p>
      {onRetry && <button type="button" className="btn btn-ghost-danger" onClick={onRetry}>Reintentar</button>}
    </div>
  );
}
