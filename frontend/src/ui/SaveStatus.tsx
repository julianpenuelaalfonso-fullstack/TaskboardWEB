import { useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function SaveStatus() {
  const saving = useIsMutating() > 0;
  const [everSaved, setEverSaved] = useState(false);
  useEffect(() => { if (saving) setEverSaved(true); }, [saving]);
  return (
    <span className="save-status" role="status">
      {saving ? "Guardando…" : everSaved ? "Guardado" : ""}
    </span>
  );
}
