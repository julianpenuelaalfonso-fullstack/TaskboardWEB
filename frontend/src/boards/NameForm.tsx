import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { Field } from "../ui/Field";

// Réplica de nameSchema del backend: trim, 1 a 100 caracteres.
export const validateName = (v: string): string | null => {
  const n = v.trim().length;
  if (n < 1) return "Escribe un nombre.";
  return n > 100 ? "El nombre admite máximo 100 caracteres." : null;
};

export function NameForm({ submitLabel, pending, error, onSubmit, onCancel }: {
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (name: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const apiError = error instanceof ApiError ? (error.fields?.name ?? error.message) : error ? "No se pudo completar la acción. Inténtalo de nuevo." : undefined;
  const shown = (touched ? validateName(name) : null) ?? apiError;

  const busy = useRef(false); // `pending` llega un tick tarde: este ref frena el doble clic
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (busy.current || pending || validateName(name)) return;
    busy.current = true;
    try { await onSubmit(name.trim()); } finally { busy.current = false; }
  };

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="name-form">
      <Field label="Nombre" error={shown}>
        <input value={name} autoComplete="off"
          onChange={(e) => { setName(e.target.value); setTouched(true); }} />
      </Field>
      <div className="dialog-actions">
        <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="primary" disabled={pending}>{submitLabel}</button>
      </div>
    </form>
  );
}
