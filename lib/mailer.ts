// lib/mailer.ts
// Envío de correos transaccionales (verificación de cuenta) vía SMTP de
// Gmail con Nodemailer — mismo patrón y misma cuenta que lib/mailer.ts en
// yelifin-sistema (hikonta.app@gmail.com). El código/enlace en sí lo sigue
// generando y validando Firebase (ver lib/firebase-admin.ts) — esto solo
// controla el diseño y el envío del correo, no el link de verificación.
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "MAIL_USER / MAIL_PASSWORD no configurados — revisa .env.local (contraseña de aplicación de Gmail)."
    );
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return transporter;
}

export async function sendMail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  // Alternativa en texto plano (multipart/alternative) — mejora la señal
  // de spam: un correo HTML sin versión de texto es algo que muchos
  // filtros penalizan.
  text?: string;
}): Promise<void> {
  const user = process.env.MAIL_USER;
  await getTransporter().sendMail({
    from: `"HiKonta Partners" <${user}>`,
    to,
    subject,
    html,
    text,
  });
}
