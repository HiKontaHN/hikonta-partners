import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { sql } from "@/lib/db";
import { createErrorResponse } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import { verifyPartnerEmailTemplate } from "@/lib/email-templates";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

// POST /api/partner/send-verification-email — igual patrón que
// yelifin-sistema/app/api/auth/send-verification-email: el código de
// verificación lo sigue generando Firebase (adminAuth.generateEmailVerificationLink),
// nosotros solo componemos y mandamos el correo con lib/mailer.ts +
// lib/email-templates.ts en vez de dejar que Firebase mande el suyo.
//
// A propósito NO usa verifyPartner() de lib/auth.ts: esa función rechaza
// con 403 si partners.is_active = FALSE, y este endpoint es justo lo
// primero que se llama después de /api/partner/register — en ese momento
// is_active siempre es FALSE (pendiente de aprobación). Acá solo hace
// falta un token de Firebase válido; el nombre de la incubadora es un
// best-effort (si no hay fila en `partners` todavía, el correo sale
// igual con un saludo genérico) — confirma que la cuenta es de partner
// sin bloquear el envío por el estado de aprobación.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return createErrorResponse("No autorizado", 401);
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return createErrorResponse("Token inválido o expirado", 401);
  }

  const email = decodedToken.email;
  if (!email) return createErrorResponse("La cuenta no tiene correo asociado", 400);

  // 5 reenvíos por IP cada 10 minutos — el botón "Reenviar" en
  // /verify-email ya tiene su propio cooldown de 60s en el cliente, esto
  // es solo el límite duro contra abuso.
  const { allowed, retryAfterSec } = rateLimit(
    `send-verification-email:${getClientIP(request)}`,
    5,
    10 * 60 * 1000,
  );
  if (!allowed) {
    return Response.json(
      { error: `Demasiados intentos. Intenta de nuevo en ${retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  try {
    const [partner] = await sql`
      SELECT p.name FROM users u
      JOIN partners p ON p.user_id = u.id
      WHERE u.firebase_uid = ${decodedToken.uid}
      LIMIT 1
    `;

    const actionLink = await adminAuth.generateEmailVerificationLink(email);
    const { subject, html, text } = verifyPartnerEmailTemplate({
      actionLink,
      incubatorName: partner?.name ?? "tu incubadora",
    });
    await sendMail({ to: email, subject, html, text });

    return Response.json({ data: { sent: true } });
  } catch (error) {
    console.error("POST /api/partner/send-verification-email:", error);
    return createErrorResponse("No se pudo enviar el correo de verificación", 500);
  }
}
