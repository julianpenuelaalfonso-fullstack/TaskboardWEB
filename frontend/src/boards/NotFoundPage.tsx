import { Link } from "react-router-dom";

export function NotFoundPage({ message = "Este tablero no existe o no tienes acceso" }: { message?: string }) {
  return (
    <main>
      <h1 className="page-title">No encontrado</h1>
      <p>{message}</p>
      <p><Link to="/app">Ir a tus tableros</Link></p>
    </main>
  );
}
