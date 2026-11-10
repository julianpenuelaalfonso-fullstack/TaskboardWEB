import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { CLIENT_IP_HEADER } from "../middleware/clientIp.js";
import { env } from "../env.js";
import { sendEmail } from "./email.js";
import { ensurePersonalWorkspace } from "./personalWorkspace.js";

const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : undefined;

export const auth = betterAuth({
  baseURL: env.APP_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: 3600,
    // Sin await: el tiempo de respuesta no debe delatar si el correo existe. Better Auth ya
    // ejecuta esto con runInBackgroundOrAwait; aquí además se traga el error de envío.
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Restablece tu contraseña de TaskBoard",
        text: `Para elegir una contraseña nueva abre este enlace (caduca en 1 hora):\n${url}`,
      }).catch((err: unknown) => console.error("[email] fallo al enviar el restablecimiento", err));
    },
  },
  socialProviders: google,
  // Sin trustedProviders: en 1.7.20 eso vincula aunque el correo de Google no esté verificado.
  account: { accountLinking: { enabled: true } },
  advanced: { ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] } },
  rateLimit: { enabled: env.NODE_ENV !== "test" },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Si falla y se relanza, el registro responde 5xx con el usuario ya creado. El respaldo
          // de GET /api/workspaces crea el workspace después.
          try {
            await ensurePersonalWorkspace(user.id);
          } catch (err) {
            console.error("[auth] no se pudo crear el workspace personal", err);
          }
        },
      },
    },
  },
});
