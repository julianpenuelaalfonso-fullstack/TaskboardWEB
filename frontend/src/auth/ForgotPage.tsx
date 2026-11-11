import { useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "../ui/Field";
import { AuthLayout } from "./AuthLayout";
import { authClient } from "./authClient";
import { useAccountForm } from "./useAccountForm";
import { validateEmail } from "./validation";

export function ForgotPage() {
  const [sent, setSent] = useState(false);
  // Misma respuesta exista o no la cuenta (y falle o no el envío): no se revela nada.
  const form = useAccountForm({ email: validateEmail }, async ({ email }) => {
    await authClient.requestPasswordReset({ email, redirectTo: "/restablecer" }).catch(() => null);
    setSent(true);
    return null;
  });

  return (
    <AuthLayout title="Recuperar contraseña">
      {sent ? (
        <p className="auth-note" role="status">Si existe una cuenta con ese correo, te enviamos un enlace.</p>
      ) : (
        <form noValidate onBlur={form.onBlur} onSubmit={form.onSubmit}>
          <Field label="Correo" error={form.errors.email}><input name="email" type="email" autoComplete="email" /></Field>
          <button className="primary" type="submit" disabled={form.busy}>Enviar enlace</button>
        </form>
      )}
      <div className="auth-links"><Link to="/login">Volver a iniciar sesión</Link></div>
    </AuthLayout>
  );
}
