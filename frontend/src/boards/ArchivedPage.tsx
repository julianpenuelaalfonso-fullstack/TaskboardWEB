import { useState } from "react";
import { useArchivedBoards, useDeleteBoard, useUpdateBoard } from "../api/boards";
import type { BoardWithWorkspace } from "../api/types";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
import { BOARD_COLORS } from "./colors";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import "./boards.css";

export function ArchivedPage() {
  const boards = useArchivedBoards();
  const update = useUpdateBoard();
  const remove = useDeleteBoard();
  const toast = useToast();
  const [target, setTarget] = useState<BoardWithWorkspace | null>(null);

  const restore = (b: BoardWithWorkspace) =>
    update.mutate({ id: b.id, archived: false }, {
      onSuccess: () => toast.show("Tablero restaurado"),
      onError: () => toast.show("No se pudo restaurar el tablero. Inténtalo de nuevo.")
    });

  const confirmDelete = async () => {
    if (!target) return;
    try {
      await remove.mutateAsync(target.id);
      toast.show("Tablero eliminado");
    } catch {
      toast.show("No se pudo eliminar el tablero. Inténtalo de nuevo.");
    }
    setTarget(null);
  };

  return (
    <main>
      <header className="board-head"><h1 className="page-title">Archivados</h1></header>
      {boards.isPending ? <Skeleton lines={4} /> : boards.isError ? (
        <div className="alert" role="alert">
          <p>{boards.error.message}</p>
          <button type="button" className="alert-retry" onClick={() => void boards.refetch()}>Reintentar</button>
        </div>
      ) : boards.data.length === 0 ? (
        <EmptyState title="No tienes tableros archivados." />
      ) : (
        <ul>
          {boards.data.map((b) => (
            <li key={b.id} className="row">
              <span className="row-main">
                <span className="dot" style={{ background: BOARD_COLORS[b.color] }} aria-hidden="true" />
                <span>{b.name} <span className="muted">· {b.workspaceName}</span></span>
              </span>
              <button type="button" className="secondary-btn" aria-label={`Restaurar "${b.name}"`} onClick={() => restore(b)}>Restaurar</button>
              <button type="button" className="secondary-btn danger-text" aria-label={`Eliminar "${b.name}"`} onClick={() => setTarget(b)}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}
      <DeleteConfirmDialog name={target?.name ?? ""} open={target !== null} onClose={() => setTarget(null)}
        title="Eliminar tablero" description="Se eliminarán también todas sus tareas. Esta acción no se puede deshacer."
        onConfirm={confirmDelete} />
    </main>
  );
}
