import { useEffect, useState } from "react";
import { KanbanSquare, FolderKanban, Building2, Users, UserRound, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "./lib/auth";
import { Avatar } from "./components/ui";
import Login from "./pages/Login";
import Board from "./pages/Board";
import Projects from "./pages/Projects";
import Departments from "./pages/Departments";
import UsersPage from "./pages/Users";
import Profile from "./pages/Profile";

// Navegación simple por hash: #/tablero, #/proyectos, ...
function useRoute() {
  const read = () => {
    const [path, query = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
    return { path: path || "tablero", params: Object.fromEntries(new URLSearchParams(query)) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

export default function App() {
  const { user, permissions, checking, logout } = useAuth();
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [route.path]);

  if (checking) return <p className="boot" role="status">Cargando TaskBoard...</p>;
  if (!user) return <Login />;

  const nav = [
    { id: "tablero", label: "Tablero", icon: KanbanSquare },
    { id: "proyectos", label: "Proyectos", icon: FolderKanban },
    { id: "departamentos", label: "Departamentos", icon: Building2 },
    ...(permissions.manageUsers ? [{ id: "usuarios", label: "Usuarios", icon: Users }] : []),
    { id: "perfil", label: "Mi perfil", icon: UserRound }
  ];

  const pages = {
    tablero: <Board params={route.params} />,
    proyectos: <Projects />,
    departamentos: <Departments />,
    usuarios: permissions.manageUsers ? <UsersPage /> : null,
    perfil: <Profile />
  };
  const page = pages[route.path] ?? pages.tablero;

  return (
    <div className="layout">
      <aside className={menuOpen ? "sidebar is-open" : "sidebar"}>
        <div className="sidebar-top">
          <a href="#/tablero" className="logo">Task<span>Board</span></a>
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <nav className="nav" aria-label="Principal">
          {nav.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#/${id}`} className="nav-link"
              aria-current={route.path === id || (!pages[route.path] && id === "tablero") ? "page" : undefined}>
              <Icon size={19} aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-user">
          <Avatar name={user.name} />
          <div className="sidebar-user-info">
            <strong>{user.name}</strong>
            <span>{user.role_name}{user.department_name ? ` · ${user.department_name}` : ""}</span>
          </div>
          <button type="button" className="icon-btn" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut size={19} aria-hidden="true" />
          </button>
        </div>
      </aside>
      <main className="content" id="contenido">{page}</main>
    </div>
  );
}
