import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useBoards } from "../api/boards";
import { useWorkspaces } from "../api/workspaces";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { CreateBoardDialog } from "./CreateBoardDialog";

function FirstBoard({ workspaceId }: { workspaceId: string }) {
  const boards = useBoards(workspaceId);
  const [open, setOpen] = useState(false);
  if (boards.isPending) return <Skeleton lines={4} />;
  const first = boards.data?.[0];
  if (first) return <Navigate to={`/app/b/${first.id}`} replace />;
  return (
    <>
      <EmptyState title="Crea tu primer tablero"
        action={<button type="button" className="cta" onClick={() => setOpen(true)}>Crear tablero</button>} />
      <CreateBoardDialog workspaceId={workspaceId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// /app: abre el primer tablero activo del workspace personal o muestra el estado vacío.
export function AppIndex() {
  const workspaces = useWorkspaces();
  const personal = workspaces.data?.find((w) => w.isPersonal);
  return <main>{personal ? <FirstBoard workspaceId={personal.id} /> : workspaces.isPending ? <Skeleton lines={4} /> : null}</main>;
}
