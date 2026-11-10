import { useEffect, useRef, type ReactNode } from "react";

export function Dialog({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  // El <dialog> nativo atrapa el foco y cierra con Esc (evento close).
  return (
    <dialog ref={ref} className="dialog" aria-label={title} onClose={onClose}>
      {open && (
        <>
          <h2>{title}</h2>
          {children}
        </>
      )}
    </dialog>
  );
}
