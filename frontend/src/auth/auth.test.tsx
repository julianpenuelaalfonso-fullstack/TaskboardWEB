import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate, useRoutes } from "react-router-dom";
import { apiFetch, setUnauthorizedHandler } from "../api/client";
import { ToastProvider } from "../ui/Toast";
import { RequireAuth } from "./RequireAuth";
import { authRoutes } from "./routes";
import { createUnauthorizedHandler, safeNext } from "./redirect";

const mocks = vi.hoisted(() => ({
  session: { data: null as unknown, isPending: false },
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: vi.fn() },
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn()
}));
vi.mock("./authClient", () => ({
  authClient: {
    useSession: () => mocks.session,
    signIn: mocks.signIn,
    signUp: mocks.signUp,
    requestPasswordReset: mocks.requestPasswordReset,
    resetPassword: mocks.resetPassword
  }
}));

// MemoryRouter (no el router de datos): jsdom y undici no comparten AbortSignal en las navegaciones.
function Routes() {
  return useRoutes([...authRoutes, { path: "/app/*", element: <RequireAuth><p>App</p></RequireAuth> }]);
}
function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
const renderAt = (url: string) =>
  render(<ToastProvider><MemoryRouter initialEntries={[url]}><Routes /><Where /></MemoryRouter></ToastProvider>);
const where = () => screen.getByTestId("where").textContent;
const fill = async (label: string, value: string) =>
  fireEvent.change(await screen.findByLabelText(label), { target: { value } });
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  mocks.session.data = null;
  mocks.session.isPending = false;
  mocks.signIn.email.mockResolvedValue({ data: {}, error: null });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("formularios de cuenta", () => {
  it("valida el correo al salir del campo", async () => {
    renderAt("/login");
    await fill("Correo", "ana@");
    fireEvent.blur(screen.getByLabelText("Correo"));
    expect(await screen.findByText("Escribe un correo válido.")).toBeInTheDocument();
  });

  it("valida la contraseña corta en el registro", async () => {
    renderAt("/registro");
    await fill("Contraseña", "corta");
    fireEvent.blur(screen.getByLabelText("Contraseña"));
    expect(await screen.findByText("La contraseña debe tener al menos 10 caracteres.")).toBeInTheDocument();
  });

  it("registro con correo existente muestra el mensaje accionable", async () => {
    mocks.signUp.email.mockResolvedValue({ data: null, error: { status: 422, code: "USER_ALREADY_EXISTS", message: "x" } });
    renderAt("/registro");
    await fill("Nombre", "Ana");
    await fill("Correo", "ana@example.com");
    await fill("Contraseña", "una-clave-larga");
    click("Crear cuenta");
    expect(await screen.findByText("Ese correo ya tiene cuenta. Inicia sesión o recupera tu contraseña.")).toBeInTheDocument();
  });

  it.each([
    ["200", { data: { status: true }, error: null }],
    ["404", { data: null, error: { status: 404, message: "no" } }]
  ])("recuperar muestra el mismo texto si la API responde %s", async (_n, result) => {
    mocks.requestPasswordReset.mockResolvedValue(result);
    renderAt("/recuperar");
    await fill("Correo", "ana@example.com");
    click("Enviar enlace");
    expect(await screen.findByText("Si existe una cuenta con ese correo, te enviamos un enlace.")).toBeInTheDocument();
  });

  it("restablecer sin token muestra un enlace a /recuperar", async () => {
    renderAt("/restablecer");
    expect(await screen.findByRole("link", { name: "Pedir un enlace nuevo" })).toHaveAttribute("href", "/recuperar");
  });

  it("restablecer con error=INVALID_TOKEN muestra el mismo aviso", async () => {
    renderAt("/restablecer?error=INVALID_TOKEN");
    expect(await screen.findByRole("link", { name: "Pedir un enlace nuevo" })).toBeInTheDocument();
  });

  it("restablecer envía token y contraseña", async () => {
    mocks.resetPassword.mockResolvedValue({ data: {}, error: null });
    renderAt("/restablecer?token=abc");
    await fill("Contraseña nueva", "otra-clave-larga");
    click("Guardar contraseña");
    await waitFor(() => expect(mocks.resetPassword).toHaveBeenCalledWith({ newPassword: "otra-clave-larga", token: "abc" }));
    await waitFor(() => expect(where()).toBe("/login"));
  });
});

describe("Google", () => {
  it("account_not_linked muestra el mensaje de cuenta existente", async () => {
    renderAt("/login?error=account_not_linked");
    expect(await screen.findByText("Ya tienes una cuenta con ese correo. Inicia sesión con tu contraseña.")).toBeInTheDocument();
  });

  it("otro error muestra el mensaje genérico", async () => {
    renderAt("/login?error=access_denied");
    expect(await screen.findByText("No se pudo iniciar sesión con Google. Inténtalo de nuevo.")).toBeInTheDocument();
  });

  it("el botón inicia el flujo con callbackURL seguro", async () => {
    renderAt("/login?next=%2Fapp%2Fb%2F1");
    fireEvent.click(await screen.findByRole("button", { name: "Continuar con Google" }));
    expect(mocks.signIn.social).toHaveBeenCalledWith({ provider: "google", callbackURL: "/app/b/1", errorCallbackURL: "/login" });
  });
});

describe("rutas protegidas y next", () => {
  it("RequireAuth sin sesión redirige a /login con next", async () => {
    renderAt("/app/b/123");
    await waitFor(() => expect(where()).toBe("/login?next=%2Fapp%2Fb%2F123"));
  });

  it("RequireAuth con sesión muestra el contenido", async () => {
    mocks.session.data = { user: { id: "1" } };
    renderAt("/app/b/123");
    expect(await screen.findByText("App")).toBeInTheDocument();
  });

  it("páginas públicas con sesión redirigen a /app", async () => {
    mocks.session.data = { user: { id: "1" } };
    renderAt("/login");
    await waitFor(() => expect(where()).toBe("/app"));
  });

  it("next externo lleva a /app tras el login", async () => {
    renderAt("/login?next=https%3A%2F%2Fevil.dev");
    await fill("Correo", "ana@example.com");
    await fill("Contraseña", "una-clave-larga");
    click("Iniciar sesión");
    await waitFor(() => expect(where()).toBe("/app"));
  });

  it("safeNext solo acepta rutas /app", () => {
    expect(safeNext("/app/b/1?x=1")).toBe("/app/b/1?x=1");
    expect(safeNext("/app")).toBe("/app");
    for (const bad of [null, "", "//evil.dev", "/apple", "https://evil.dev", "/\\evil", "/login", "/app/../login", "/app/b/../../x?y=1"]) expect(safeNext(bad)).toBe("/app");
  });
});

describe("401 en una mutación", () => {
  it("redirige a /login con la ruta actual, salvo para /auth/*", async () => {
    const navigate = vi.fn();
    setUnauthorizedHandler(createUnauthorizedHandler(navigate, () => "/app/b/9?x=1", async () => {}));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "unauthorized", message: "no" } }), { status: 401 })));
    await expect(apiFetch("/tasks/1", { method: "PATCH", body: "{}" })).rejects.toMatchObject({ status: 401 });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login?next=%2Fapp%2Fb%2F9%3Fx%3D1"));
    navigate.mockClear();
    await expect(apiFetch("/auth/sign-in/email", { method: "POST", body: "{}" })).rejects.toMatchObject({ status: 401 });
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("401 con sesión en caché", () => {
function Routes2() {
    return useRoutes([...authRoutes, { path: "/app/*", element: <RequireAuth><Trigger /></RequireAuth> }]);
  }
  function Trigger() {
    const navigate = useNavigate();
    const loc = useLocation();
    return (
      <button onClick={() => {
        // Como main.tsx: refrescar la sesión (aquí queda sin sesión) y luego navegar.
        setUnauthorizedHandler(createUnauthorizedHandler(
          (to) => navigate(to), () => loc.pathname + loc.search, async () => { mocks.session.data = null; }
        ));
        apiFetch("/tasks/1", { method: "PATCH", body: "{}" }).catch(() => undefined);
      }}>Disparar</button>
    );
  }

  it("termina en /login sin rebotar a /app", async () => {
    mocks.session.data = { user: { id: "1" } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/app/b/5"]}>
          <Routes2 />
          <Where />
        </MemoryRouter>
      </ToastProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: "Disparar" }));
    await waitFor(() => expect(where()).toBe("/login?next=%2Fapp%2Fb%2F5"));
    await new Promise((r) => setTimeout(r, 50));
    expect(where()).toBe("/login?next=%2Fapp%2Fb%2F5");
  });
});

describe("cuentas: casos sueltos", () => {
  it("el login no exige 10 caracteres", async () => {
    renderAt("/login");
    await fill("Contraseña", "corta");
    fireEvent.blur(screen.getByLabelText("Contraseña"));
    await waitFor(() => expect(screen.queryByText("La contraseña debe tener al menos 10 caracteres.")).not.toBeInTheDocument());
    await fill("Contraseña", "");
    fireEvent.blur(screen.getByLabelText("Contraseña"));
    expect(await screen.findByText("Escribe tu contraseña.")).toBeInTheDocument();
  });

  it("restablecer con sesión activa conserva el token", async () => {
    mocks.session.data = { user: { id: "1" } };
    renderAt("/restablecer?token=abc");
    expect(await screen.findByLabelText("Contraseña nueva")).toBeInTheDocument();
    expect(where()).toBe("/restablecer?token=abc");
  });

  it("el botón de Google del registro vuelve a /login en error", async () => {
    renderAt("/registro");
    fireEvent.click(await screen.findByRole("button", { name: "Continuar con Google" }));
    expect(mocks.signIn.social).toHaveBeenCalledWith({ provider: "google", callbackURL: "/app", errorCallbackURL: "/login" });
  });
});
