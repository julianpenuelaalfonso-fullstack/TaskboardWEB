import { useState, type KeyboardEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useBoard, useUpdateBoard } from "../api/boards";
import { ApiError } from "../api/client";
import { SaveStatus } from "../ui/SaveStatus";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
import { BoardMenu } from "./BoardMenu";
import { BOARD_COLORS } from "./colors";
import { NameForm } from "./NameForm";
import { NotFoundPage } from "./NotFoundPage";
import { TaskList } from "./TaskList";
import "./boards.css";

export function BoardPage() {
  const boardId = useParams().boardId!;
  const board = useBoard(boardId);
  const update = useUpdateBoard();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);

  if (board.error instanceof ApiError && board.error.status === 404) return <NotFoundPage />;
  if (board.isPending) return <main><Skeleton lines={5} /></main>;
  if (board.isError) {
    return (
      <main>
        <div className="alert" role="alert">
          <p>{board.error.message}</p>
          <button type="button" className="alert-retry" onClick={() => void board.refetch()}>Reintentar</button>
        </div>
      </main>
    );
  }
  const b = board.data;
  const cancel = () => setRenaming(false);

  return (
    <main>
      <header className="board-head">
        <div className="board-title">
          <p className="crumb"><Link to={`/app/w/${b.workspaceId}`}>{b.workspaceName}</Link> /</p>
          {renaming ? (
            <div onKeyDown={(e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); cancel(); } }}>
              <NameForm initial={b.name} submitLabel="Guardar" pending={update.isPending} error={update.error} onCancel={cancel}
                onSubmit={(name) => update.mutateAsync({ id: b.id, name }, {
                  onSuccess: () => { cancel(); toast.show("Tablero renombrado"); }
                }).catch(() => {})} />
            </div>
          ) : (
            <h1 className="page-title">
              <span className="dot" style={{ background: BOARD_COLORS[b.color] }} aria-hidden="true" />
              {b.name}
            </h1>
          )}
        </div>
        <div className="board-tools">
          <SaveStatus />
          <BoardMenu board={b} onRename={() => { update.reset(); setRenaming(true); }} />
        </div>
      </header>
      <TaskList key={b.id} boardId={b.id} />
    </main>
  );
}
