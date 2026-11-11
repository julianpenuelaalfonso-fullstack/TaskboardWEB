import { useState, type FocusEvent, type FormEvent } from "react";

type Validators = Record<string, (v: string) => string | null>;

export const GENERIC_ERROR = "No se pudo completar la acción. Revisa tu conexión e inténtalo de nuevo.";

// Formulario no controlado: valida un campo al salir de él y todos al enviar.
export function useAccountForm(validators: Validators, submit: (values: Record<string, string>) => Promise<string | null>) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return {
    errors, formError, busy,
    onBlur: (e: FocusEvent<HTMLFormElement>) => {
      const { name, value } = e.target as unknown as HTMLInputElement;
      const check = validators[name];
      if (check) setErrors((prev) => ({ ...prev, [name]: check(value) ?? "" }));
    },
    onSubmit: async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const next: Record<string, string> = {};
      for (const [name, check] of Object.entries(validators)) next[name] = check(values[name] ?? "") ?? "";
      setErrors(next);
      setFormError(null);
      if (Object.values(next).some(Boolean)) return;
      setBusy(true);
      try { setFormError(await submit(values)); } finally { setBusy(false); }
    }
  };
}
