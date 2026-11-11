import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Field } from "../ui/Field";
import { AuthLayout } from "./AuthLayout";
import { authClient } from "./authClient";
import { safeNext } from "./redirect";
import { GENERIC_ERROR, useAccountForm } from "./useAccountForm";
import { validateEmail, validatePassword } from "./validation";

const oauthError = (code: string) =>
  code === "account_not_linked"
    ? "Ya tienes una cuenta con ese correo. Inicia sesión con tu contraseña."
    : "No se pudo iniciar sesión con Google. Inténtalo de nuevo.";

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const urlError = params.get("error");
  const form = useAccountForm({ email: validateEmail, password: validatePassword }, async ({ email, password }) => {
    const { error } = await authClient.signIn.email({ email, password });
    if (!error) { navigate(next, { replace: true }); return null; }
    return error.status === 401 || error.status === 400 || error.code === "INVALID_EMAIL_OR_PASSWORD"
      ? "Correo o contraseña incorrectos. Revisa los datos o recupera tu contraseña."
      : GENERIC_ERROR;
  });
  const error = form.formError ?? (urlError ? oauthError(urlError) : null);

  return (
    <AuthLayout title="Iniciar sesión">
      {error && <div className="alert" role="alert"><p>{error}</p></div>}
      <form noValidate onBlur={form.onBlur} onSubmit={form.onSubmit}>
        <Field label="Correo" error={form.errors.email}><input name="email" type="email" autoComplete="email" /></Field>
        <Field label="Contraseña" error={form.errors.password}><input name="password" type="password" autoComplete="current-password" /></Field>
        <button className="primary" type="submit" disabled={form.busy}>Iniciar sesión</button>
      </form>
      <button className="google" type="button"
        onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/login" })}>
        Continuar con Google
      </button>
      <div className="auth-links">
        <Link to="/registro">Crear cuenta</Link>
        <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
      </div>
    </AuthLayout>
  );
}
