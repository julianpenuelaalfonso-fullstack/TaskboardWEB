import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Field } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { AuthLayout } from "./AuthLayout";
import { authClient } from "./authClient";
import { GENERIC_ERROR, useAccountForm } from "./useAccountForm";
import { validatePassword } from "./validation";

export function ResetPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const toast = useToast();
  const form = useAccountForm({ newPassword: validatePassword }, async ({ newPassword }) => {
    const { error } = await authClient.resetPassword({ newPassword, token: token! });
    if (!error) {
      toast.show("Contraseña actualizada. Inicia sesión con la nueva.");
      navigate("/login", { replace: true });
      return null;
    }
    return error.code === "INVALID_TOKEN" ? "El enlace caducó o ya se usó. Pide uno nuevo." : GENERIC_ERROR;
  });

  // Sin token, o con ?error=INVALID_TOKEN (así redirige Better Auth), el enlace no sirve.
  if (!token) {
    return (
      <AuthLayout title="Enlace no válido">
        <p>El enlace para restablecer la contraseña no es válido o caducó.</p>
        <div className="auth-links"><Link to="/recuperar">Pedir un enlace nuevo</Link></div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Nueva contraseña">
      {form.formError && (
        <div className="alert" role="alert"><p>{form.formError} <Link to="/recuperar">Pedir un enlace nuevo</Link></p></div>
      )}
      <form noValidate onBlur={form.onBlur} onSubmit={form.onSubmit}>
        <Field label="Contraseña nueva" error={form.errors.newPassword}><input name="newPassword" type="password" autoComplete="new-password" /></Field>
        <button className="primary" type="submit" disabled={form.busy}>Guardar contraseña</button>
      </form>
    </AuthLayout>
  );
}
