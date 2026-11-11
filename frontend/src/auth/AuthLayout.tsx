import type { ReactNode } from "react";
import "./auth.css";

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="auth">
      <p className="auth-brand">TaskBoard</p>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
