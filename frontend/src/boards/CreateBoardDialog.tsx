import { useNavigate } from "react-router-dom";
import { useCreateBoard } from "../api/boards";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { NameForm } from "./NameForm";

export function CreateBoardDialog({ workspaceId, open, onClose }: { workspaceId: string; open: boolean; onClose: () => void }) {
  const create = useCreateBoard(workspaceId);
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <Dialog open={open} onClose={onClose} title="Nuevo tablero">
      <NameForm submitLabel="Crear tablero" pending={create.isPending} error={create.error} onCancel={onClose}
        onSubmit={(name) => create.mutateAsync({ name }, {
          onSuccess: (b) => { onClose(); toast.show("Tablero creado"); navigate(`/app/b/${b.id}`); }
        }).catch(() => {})} />
    </Dialog>
  );
}
