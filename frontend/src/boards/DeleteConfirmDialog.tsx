import { useRef, useState, type FormEvent } from "react";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";

type Props = {
  name: string;
  title?: string;
  description?: string;
  open?: boolean;
  onClose?: () => void;
  onConfirm: () => unknown;
};

// El estado vive en el formulario: el Dialog solo lo monta abierto, así cada apertura empieza vacía.
function ConfirmForm({ name, description, onClose, onConfirm }: Required<Pick<Props, "name" | "description" | "onClose" | "onConfirm">>) {
  const [typed, setTyped] = useState("");
  const busy = useRef(false);
  const matches = typed === name;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!matches || busy.current) return;
    busy.current = true;
    try { await onConfirm(); } finally { busy.current = false; }
  };
  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="name-form">
      <p>{description}</p>
      <Field label={`Escribe «${name}» para confirmar`}>
        <input value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
      </Field>
      <div className="dialog-actions">
        <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="danger" disabled={!matches}>Eliminar</button>
      </div>
    </form>
  );
}

// RF-089: el botón solo se habilita al escribir el nombre exacto.
export function DeleteConfirmDialog({ name, title = "Confirmar eliminación", description = "Esta acción no se puede deshacer.", open = true, onClose = () => {}, onConfirm }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <ConfirmForm name={name} description={description} onClose={onClose} onConfirm={onConfirm} />
    </Dialog>
  );
}
