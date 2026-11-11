import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { ForgotPage } from "./ForgotPage";
import { LoginPage } from "./LoginPage";
import { PublicOnly } from "./RequireAuth";
import { RegisterPage } from "./RegisterPage";
import { ResetPage } from "./ResetPage";

const pub = (path: string, el: ReactNode): RouteObject => ({ path, element: <PublicOnly>{el}</PublicOnly> });

export const authRoutes: RouteObject[] = [
  pub("/login", <LoginPage />),
  pub("/registro", <RegisterPage />),
  pub("/recuperar", <ForgotPage />),
  pub("/restablecer", <ResetPage />)
];
