import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closingFromProp = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) {
      closingFromProp.current = true; // el padre ya sabe que se cerró: no repetir onClose
      d.close();
    }
  }, [open]);
  // El <dialog> nativo atrapa el foco y cierra con Esc (evento close).
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={() => {
        if (closingFromProp.current) closingFromProp.current = false;
        else onClose();
      }}
    >
      {open && (
        <>
          <h2 id={titleId}>{title}</h2>
          {children}
        </>
      )}
    </dialog>
  );
}
