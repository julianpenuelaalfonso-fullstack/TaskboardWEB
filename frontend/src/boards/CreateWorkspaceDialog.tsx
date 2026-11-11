import { useNavigate } from "react-router-dom";
import { useCreateWorkspace } from "../api/workspaces";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { NameForm } from "./NameForm";

export function CreateWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <Dialog open={open} onClose={onClose} title="Nuevo workspace">
      <NameForm submitLabel="Crear workspace" pending={create.isPending} error={create.error} onCancel={onClose}
        onSubmit={(name) => create.mutateAsync(name, {
          onSuccess: (w) => { onClose(); toast.show("Workspace creado"); navigate(`/app/w/${w.id}`); }
        }).catch(() => {})} />
    </Dialog>
  );
}
