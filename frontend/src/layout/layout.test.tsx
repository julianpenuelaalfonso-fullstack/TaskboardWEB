import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ApiError } from "../api/client";
import { useDeleteWorkspace } from "../api/workspaces";
import { ToastProvider } from "../ui/Toast";
import { AppShell } from "./AppShell";

vi.mock("../auth/authClient", () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: "Ana" } }, isPending: false }),
    signOut: vi.fn(),
    changePassword: vi.fn()
  }
}));

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ws = [{ id: "w1", name: "Personal", isPersonal: true, role: "owner" }];
const board = { id: "b1", workspaceId: "w1", name: "Taller", color: "cobalt", archivedAt: null, createdAt: "", updatedAt: "" };

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
function Deleter() {
  const del = useDeleteWorkspace();
  return <button onClick={() => del.mutate("w1")}>borrar-ws</button>;
}

function renderShell(client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), url = "/app") {
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Deleter />} />
              <Route path="b/:boardId" element={<p>tablero</p>} />
            </Route>
          </Routes>
          <Where />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("AppShell", () => {
  it("muestra un skeleton mientras cargan los workspaces", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { container } = renderShell();
    expect(container.querySelector(".skeleton")).toBeInTheDocument();
  });

  it("lista los workspaces con sus tableros y marca el actual", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => json(200, url.endsWith("/workspaces") ? ws : [board])));
    renderShell(undefined, "/app/b/b1");
    const link = await screen.findByRole("link", { name: "Taller" });
    expect(link).toHaveAttribute("href", "/app/b/b1");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archivados" })).toBeInTheDocument();
  });

  it("doble clic en Crear tablero envía un solo POST y navega al nuevo", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json(201, { ...board, id: "b2", name: "Nuevo" });
      return json(200, url.endsWith("/workspaces") ? ws : []);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: "+ Tablero" }));
    fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "Nuevo" } });
    const create = screen.getByRole("button", { name: "Crear tablero" });
    fireEvent.click(create);
    fireEvent.click(create);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app/b/b2"));
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === "POST")).toHaveLength(1);
    expect(screen.getByText("Tablero creado")).toBeInTheDocument();
  });

  it("valida el nombre y muestra el error de la API", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? json(400, { error: { code: "validation", message: "x", fields: { name: "Nombre duplicado." } } })
        : json(200, url.endsWith("/workspaces") ? ws : [])));
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: "+ Tablero" }));
    const input = await screen.findByLabelText("Nombre");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.getByText("Escribe un nombre.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "x".repeat(101) } });
    expect(screen.getByText("El nombre admite máximo 100 caracteres.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Repetido" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear tablero" }));
    expect(await screen.findByText("Nombre duplicado.")).toBeInTheDocument();
  });

  it("al borrar un workspace sus tableros salen de la barra sin recargar", async () => {
    let deleted = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") { deleted = true; return json(204); }
      if (url.endsWith("/workspaces")) return json(200, deleted ? [] : ws);
      return json(200, deleted ? [] : [board]);
    }));
    renderShell();
    expect(await screen.findByRole("link", { name: "Taller" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("borrar-ws"));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Taller" })).not.toBeInTheDocument());
    expect(screen.queryByText("Personal")).not.toBeInTheDocument();
  });

  it("a 375px el botón Menú abre la barra y Esc la cierra devolviendo el foco", async () => {
    window.innerWidth = 375;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => json(200, url.endsWith("/workspaces") ? ws : [board])));
    renderShell();
    const menu = screen.getByRole("button", { name: "Menú" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    const sidebar = document.getElementById(menu.getAttribute("aria-controls")!)!;
    expect(sidebar.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
    fireEvent.click(menu);
    fireEvent.click(await within(sidebar).findByRole("link", { name: "Taller" }));
    expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  it("si la API no responde avisa que conecta y, agotados los reintentos, ofrece Reintentar", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fail"));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({
      defaultOptions: { queries: {
        retry: (n, e) => n < 1 && e instanceof ApiError && e.status === 0,
        retryDelay: 500
      } }
    });
    renderShell(client);
    expect(await screen.findByText("Conectando con el servidor…")).toBeInTheDocument();
    expect(screen.getByText("Si estaba en reposo, puede tardar hasta un minuto en responder.")).toBeInTheDocument();
    const retry = await screen.findByRole("button", { name: "Reintentar" }, { timeout: 3000 });
    fetchMock.mockImplementation(async () => json(200, ws));
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument());
  });
});
