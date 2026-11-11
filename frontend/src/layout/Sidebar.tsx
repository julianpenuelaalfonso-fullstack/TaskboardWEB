import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useBoards } from "../api/boards";
import { useWorkspaces } from "../api/workspaces";
import type { BoardColor, Workspace } from "../api/types";
import { CreateBoardDialog } from "../boards/CreateBoardDialog";
import { CreateWorkspaceDialog } from "../boards/CreateWorkspaceDialog";
import { Skeleton } from "../ui/Skeleton";
import { UserMenu } from "./UserMenu";

export const BOARD_COLORS: Record<BoardColor, string> = {
  cobalt: "#2433C4", teal: "#0F8A8A", green: "#2E8540", amber: "#B7791F", coral: "#D64545", violet: "#7B3FC4"
};

function WorkspaceSection({ ws, onNavigate }: { ws: Workspace; onNavigate: () => void }) {
  const boards = useBoards(ws.id);
  const [creating, setCreating] = useState(false);
  return (
    <details open className="side-ws">
      <summary>{ws.name}</summary>
      {boards.isPending ? <Skeleton lines={2} /> : (
        <ul>
          {boards.data?.map((b) => (
            <li key={b.id}>
              <NavLink to={`/app/b/${b.id}`} onClick={onNavigate}>
                <span className="dot" style={{ background: BOARD_COLORS[b.color] }} aria-hidden="true" />
                {b.name}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="side-add" onClick={() => setCreating(true)}>+ Tablero</button>
      <CreateBoardDialog workspaceId={ws.id} open={creating} onClose={() => setCreating(false)} />
    </details>
  );
}

export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const workspaces = useWorkspaces();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <p className="side-brand">TaskBoard</p>
      <nav aria-label="Workspaces y tableros">
        {workspaces.isPending ? <Skeleton lines={5} /> : workspaces.data?.map((w) => (
          <WorkspaceSection key={w.id} ws={w} onNavigate={onNavigate} />
        ))}
        <button type="button" className="side-add" onClick={() => setCreating(true)}>+ Workspace</button>
        <NavLink to="/app/archivados" className="side-link" onClick={onNavigate}>Archivados</NavLink>
      </nav>
      <CreateWorkspaceDialog open={creating} onClose={() => setCreating(false)} />
      <UserMenu />
    </>
  );
}
