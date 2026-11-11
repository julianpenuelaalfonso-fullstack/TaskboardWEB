import { useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useDeleteBoard, useUpdateBoard } from "../api/boards";
import type { BoardColor, BoardWithWorkspace } from "../api/types";
import { useToast } from "../ui/Toast";
import { BOARD_COLORS, COLOR_NAMES } from "./colors";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

export function BoardMenu({ board, onRename }: { board: BoardWithWorkspace; onRename: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const update = useUpdateBoard();
  const remove = useDeleteBoard();
  const navigate = useNavigate();
  const toast = useToast();

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) { setOpen(false); trigger.current?.focus(); }
  };

  const archive = async () => {
    setOpen(false);
    try {
      await update.mutateAsync({ id: board.id, archived: true });
    } catch {
      return toast.show("No se pudo archivar el tablero. Inténtalo de nuevo.");
    }
    toast.show("Tablero archivado", {
      actionLabel: "Deshacer",
      onAction: () => update.mutate({ id: board.id, archived: false })
    });
    navigate("/app");
  };

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(board.id);
    } catch {
      setDeleting(false);
      return toast.show("No se pudo eliminar el tablero. Inténtalo de nuevo.");
    }
    toast.show("Tablero eliminado");
    navigate("/app");
  };

  return (
    <div className="board-menu" onKeyDown={onKeyDown}>
      <button ref={trigger} type="button" className="menu-trigger" aria-expanded={open} aria-label="Opciones del tablero"
        onClick={() => setOpen((o) => !o)}>⋯</button>
      {open && (
        <div className="menu-panel">
          <button type="button" onClick={() => { setOpen(false); onRename(); }}>Renombrar</button>
          <fieldset>
            <legend>Color</legend>
            {(Object.keys(BOARD_COLORS) as BoardColor[]).map((c) => (
              <label key={c} className="color-option">
                <input type="radio" name="board-color" checked={board.color === c}
                  onChange={() => update.mutate({ id: board.id, color: c })} />
                <span className="dot" style={{ background: BOARD_COLORS[c] }} aria-hidden="true" />
                {COLOR_NAMES[c]}
              </label>
            ))}
          </fieldset>
          <button type="button" onClick={() => void archive()}>Archivar</button>
          <button type="button" className="danger-text" onClick={() => { setOpen(false); setDeleting(true); }}>Eliminar</button>
        </div>
      )}
      <DeleteConfirmDialog name={board.name} open={deleting} onClose={() => setDeleting(false)}
        title="Eliminar tablero" description="Se eliminarán también todas sus tareas. Esta acción no se puede deshacer."
        onConfirm={confirmDelete} />
    </div>
  );
}
