import { cloneElement, useId, type ReactElement } from "react";

export function Field({ label, error, children }: {
  label: string; error?: string; children: ReactElement<Record<string, unknown>>;
}) {
  const id = useId();
  const errId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, "aria-invalid": Boolean(error), "aria-describedby": error ? errId : undefined })}
      {error && <p id={errId} className="field-error">{error}</p>}
    </div>
  );
}
