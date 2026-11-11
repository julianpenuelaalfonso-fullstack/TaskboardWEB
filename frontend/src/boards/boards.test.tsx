import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "../ui/Toast";
import { AppIndex } from "./AppIndex";
import { BoardPage } from "./BoardPage";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { TaskList } from "./TaskList";

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const board = { id: "b1", workspaceId: "w1", workspaceName: "Personal", name: "Taller", color: "cobalt", archivedAt: null, createdAt: "", updatedAt: "" };
const task = { id: "t1", boardId: "b1", title: "Crear la base", done: false, createdAt: "" };

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
function renderAt(url: string, routes: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>{routes}</Routes>
          <Where />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
const deletes = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter(([, i]) => i?.method === "DELETE");

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("DeleteConfirmDialog", () => {
  it("habilita Eliminar solo con el nombre exacto", () => {
    const onConfirm = vi.fn();
    render(<DeleteConfirmDialog name="Taller Render" onConfirm={onConfirm} />);
    const btn = screen.getByRole("button", { name: "Eliminar" });
    const input = screen.getByLabelText(/Escribe/);
    expect(btn).toBeDisabled();
    fireEvent.change(input, { target: { value: "Taller" } });
    expect(btn).toBeDisabled();
    fireEvent.change(input, { target: { value: "Taller Render" } });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("TaskList: eliminar con deshacer", () => {
  const setup = async () => {
    const fetchMock = vi.fn(async (_u: string, init?: RequestInit) =>
      init?.method === "DELETE" ? json(204) : json(200, [task]));
    vi.stubGlobal("fetch", fetchMock);
    const view = renderAt("/", <Route path="/" element={<TaskList boardId="b1" />} />);
    await screen.findByText("Crear la base");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: 'Eliminar "Crear la base"' }));
    return Object.assign(fetchMock, { unmount: view.unmount });
  };

  it("no envía DELETE antes de 5000 ms y Deshacer a los 3000 ms lo cancela", async () => {
    const f = await setup();
    expect(screen.queryByText("Crear la base")).not.toBeInTheDocument();
    expect(screen.getByText("Tarea eliminada")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(screen.getByText("Crear la base")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(deletes(f)).toHaveLength(0);
  });

  it("a los 5000 ms sin deshacer envía el DELETE una vez", async () => {
    const f = await setup();
    await act(async () => { vi.advanceTimersByTime(4999); });
    expect(deletes(f)).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(deletes(f)).toHaveLength(1);
  });

  it("al salir de la página (pagehide) o desmontar envía el DELETE pendiente", async () => {
    const f = await setup();
    window.dispatchEvent(new Event("pagehide"));
    expect(deletes(f)).toHaveLength(1);
    expect(deletes(f)[0]![1]).toMatchObject({ keepalive: true });
    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(deletes(f)).toHaveLength(1);
  });

  it("al desmontar (cambio de tablero) lo envía sin esperar", async () => {
    const f = await setup();
    expect(deletes(f)).toHaveLength(0);
    f.unmount();
    await act(async () => {});
    expect(deletes(f)).toHaveLength(1);
  });
});

describe("BoardPage", () => {
  const routes = (
    <>
      <Route path="/app" element={<p>inicio</p>} />
      <Route path="/app/b/:boardId" element={<BoardPage />} />
    </>
  );

  it("archivar el tablero abierto navega a /app y ofrece Deshacer", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return json(200, { ...board, archivedAt: "x" });
      return json(200, url.endsWith("/tasks") ? [] : board);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/app/b/b1", routes);
    fireEvent.click(await screen.findByRole("button", { name: "Opciones del tablero" }));
    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/app$/));
    expect(screen.getByText("Tablero archivado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    const bodies = () => fetchMock.mock.calls.filter(([, i]) => i?.method === "PATCH").map(([, i]) => i!.body);
    await waitFor(() => expect(bodies()).toEqual(['{"archived":true}', '{"archived":false}']));
  });

  it("un 404 muestra que el tablero no existe y enlaza a /app", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, { error: { code: "not_found", message: "x" } })));
    renderAt("/app/b/zzz", routes);
    expect(await screen.findByText("Este tablero no existe o no tienes acceso")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a tus tableros" })).toHaveAttribute("href", "/app");
  });
});

describe("AppIndex", () => {
  it("sin tableros muestra Crea tu primer tablero", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      json(200, url.endsWith("/workspaces") ? [{ id: "w1", name: "Personal", isPersonal: true, role: "owner" }] : [])));
    renderAt("/app", <Route path="/app" element={<AppIndex />} />);
    expect(await screen.findByText("Crea tu primer tablero")).toBeInTheDocument();
  });

  it("con tableros redirige al primero", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      json(200, url.endsWith("/workspaces") ? [{ id: "w1", name: "Personal", isPersonal: true, role: "owner" }] : [board])));
    renderAt("/app", <><Route path="/app" element={<AppIndex />} /><Route path="/app/b/:id" element={<p>tablero</p>} /></>);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app/b/b1"));
  });
});
