import "dotenv/config";
import { z } from "zod";

const bool = z.enum(["true", "false"]).default("false").transform((v) => v === "true");
// Las variables opcionales vacías en .env cuentan como no definidas.
const optional = z.string().optional().transform((v) => v || undefined);

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  DB_SSL: bool,
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().min(1).default("TaskBoard <no-reply@taskboard.local>"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  PORT: z.coerce.number().int().positive().default(3002),
}).refine((v) => v.NODE_ENV !== "production" || v.RESEND_API_KEY, {
  path: ["RESEND_API_KEY"],
  message: "RESEND_API_KEY es obligatoria en producción (sin ella el enlace de restablecimiento acabaría en los logs)",
});

const parsed = envSchema.parse(process.env);
const DATABASE_URL = parsed.NODE_ENV === "test" ? parsed.TEST_DATABASE_URL : parsed.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(parsed.NODE_ENV === "test" ? "Falta TEST_DATABASE_URL" : "Falta DATABASE_URL");
}

export const env = { ...parsed, DATABASE_URL };
