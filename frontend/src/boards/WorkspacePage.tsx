import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBoards } from "../api/boards";
import { useDeleteWorkspace, useRenameWorkspace, useWorkspaces } from "../api/workspaces";
import { EmptyState } from "../ui/EmptyState";
import { SaveStatus } from "../ui/SaveStatus";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
import { BOARD_COLORS, COLOR_NAMES } from "./colors";
import { CreateBoardDialog } from "./CreateBoardDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { NameForm } from "./NameForm";
import { NotFoundPage } from "./NotFoundPage";
import "./boards.css";

export function WorkspacePage() {
  const id = useParams().workspaceId!;
  const workspaces = useWorkspaces();
  const boards = useBoards(id);
  const rename = useRenameWorkspace();
  const remove = useDeleteWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);

  if (workspaces.isPending) return <main><Skeleton lines={5} /></main>;
  const ws = workspaces.data?.find((w) => w.id === id);
  if (!ws) return <NotFoundPage message="Este workspace no existe o no tienes acceso" />;

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(id);
    } catch {
      setDeleting(false);
      return toast.show("No se pudo eliminar el workspace. Inténtalo de nuevo.");
    }
    toast.show("Workspace eliminado");
    navigate("/app");
  };

  return (
    <main>
      <header className="board-head">
        <div className="board-title">
          {renaming ? (
            <div onKeyDown={(e) => { if (e.key === "Escape") setRenaming(false); }}>
              <NameForm initial={ws.name} submitLabel="Guardar" pending={rename.isPending} error={rename.error}
                onCancel={() => setRenaming(false)}
                onSubmit={(name) => rename.mutateAsync({ id, name }, {
                  onSuccess: () => { setRenaming(false); toast.show("Workspace renombrado"); }
                }).catch(() => {})} />
            </div>
          ) : <h1 className="page-title">{ws.name}</h1>}
        </div>
        <div className="board-tools">
          <SaveStatus />
          {!renaming && <button type="button" className="secondary-btn" onClick={() => { rename.reset(); setRenaming(true); }}>Renombrar</button>}
          {!ws.isPersonal && <button type="button" className="secondary-btn danger-text" onClick={() => setDeleting(true)}>Eliminar workspace</button>}
        </div>
      </header>

      <section aria-labelledby="ws-boards">
        <h2 id="ws-boards">Tableros</h2>
        {boards.isPending ? <Skeleton lines={3} /> : boards.data?.length ? (
          <ul>
            {boards.data.map((b) => (
              <li key={b.id} className="row">
                <Link to={`/app/b/${b.id}`} className="row-main">
                  <span className="dot" style={{ background: BOARD_COLORS[b.color] }} aria-hidden="true" />
                  {b.name}
                </Link>
                <span className="muted">{COLOR_NAMES[b.color]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Este workspace no tiene tableros"
            action={<button type="button" className="cta" onClick={() => setCreating(true)}>Crear tablero</button>} />
        )}
      </section>

      <CreateBoardDialog workspaceId={id} open={creating} onClose={() => setCreating(false)} />
      <DeleteConfirmDialog name={ws.name} open={deleting} onClose={() => setDeleting(false)}
        title="Eliminar workspace" description="Se eliminarán también sus tableros y tareas. Esta acción no se puede deshacer."
        onConfirm={confirmDelete} />
    </main>
  );
}
