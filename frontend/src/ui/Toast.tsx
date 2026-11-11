import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Opts = { actionLabel?: string; onAction?: () => void; durationMs?: number };
type Item = Opts & { id: number; message: string };
const Ctx = createContext<{ show: (message: string, opts?: Opts) => number; dismiss: (id: number) => void } | null>(null);
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((i) => i.id !== id)), []);
  const show = useCallback((message: string, opts: Opts = {}) => {
    const id = nextId++;
    setItems((l) => [...l, { ...opts, id, message }]);
    setTimeout(() => dismiss(id), opts.durationMs ?? 5000);
    return id;
  }, [dismiss]);
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.message}</span>
            {t.actionLabel && (
              <button onClick={() => { t.onAction?.(); dismiss(t.id); }}>{t.actionLabel}</button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast requiere ToastProvider");
  return c;
}
