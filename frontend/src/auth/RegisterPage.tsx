import { Link, useNavigate } from "react-router-dom";
import { Field } from "../ui/Field";
import { AuthLayout } from "./AuthLayout";
import { authClient } from "./authClient";
import { GENERIC_ERROR, useAccountForm } from "./useAccountForm";
import { validateEmail, validatePassword } from "./validation";

const validateName = (v: string) => (v.trim() ? null : "Escribe tu nombre.");

export function RegisterPage() {
  const navigate = useNavigate();
  const form = useAccountForm({ name: validateName, email: validateEmail, password: validatePassword }, async ({ name, email, password }) => {
    const { error } = await authClient.signUp.email({ name: name.trim(), email, password });
    if (!error) { navigate("/app", { replace: true }); return null; }
    return error.code?.startsWith("USER_ALREADY_EXISTS")
      ? "Ese correo ya tiene cuenta. Inicia sesión o recupera tu contraseña."
      : GENERIC_ERROR;
  });

  return (
    <AuthLayout title="Crear cuenta">
      {form.formError && <div className="alert" role="alert"><p>{form.formError}</p></div>}
      <form noValidate onBlur={form.onBlur} onSubmit={form.onSubmit}>
        <Field label="Nombre" error={form.errors.name}><input name="name" autoComplete="name" /></Field>
        <Field label="Correo" error={form.errors.email}><input name="email" type="email" autoComplete="email" /></Field>
        <Field label="Contraseña" error={form.errors.password}><input name="password" type="password" autoComplete="new-password" /></Field>
        <button className="primary" type="submit" disabled={form.busy}>Crear cuenta</button>
      </form>
      <button className="google" type="button"
        onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/app", errorCallbackURL: "/login" })}>
        Continuar con Google
      </button>
      <div className="auth-links"><Link to="/login">Ya tengo cuenta</Link></div>
    </AuthLayout>
  );
}
