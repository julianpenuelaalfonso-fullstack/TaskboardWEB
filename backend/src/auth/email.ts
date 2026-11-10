import { Resend } from "resend";
import { env } from "../env.js";

export interface Email {
  to: string;
  subject: string;
  text: string;
}

// Solo se llena bajo NODE_ENV=test; las pruebas leen aquí los correos "enviados".
export const sentEmails: Email[] = [];

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail({ to, subject, text }: Email): Promise<void> {
  if (env.NODE_ENV === "test") {
    sentEmails.push({ to, subject, text });
    return;
  }
  if (!resend) {
    console.log(`[email] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, text });
  if (error) throw new Error(`Resend: ${error.message}`);
}
