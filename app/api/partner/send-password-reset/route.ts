// app/api/partner/send-password-reset/route.ts
// Público a propósito (nadie tiene sesión cuando olvida su contraseña) —
// por eso el límite de intentos es estricto, y la respuesta es SIEMPRE la
// misma exista o no la cuenta, para no revelar qué correos están
// registrados. Mismo patrón que /api/partner/send-verification-email: el
// link lo genera y valida Firebase, esto solo compone y manda el correo.
//
// El link cae en la página de acción POR DEFECTO de Firebase, no en una
// página propia — ver la nota en send-verification-email/route.ts sobre
// por qué (Firebase Console rechaza el Action URL personalizado en este
// proyecto).
import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { resetPartnerPasswordTemplate } from "@/lib/email-templates";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

const GENERIC_RESPONSE = {
  data: { message: "Si el correo está registrado, recibirás un enlace en breve." },
};

export async function POST(request: NextRequest) {
  // 5 solicitudes por IP cada 10 minutos.
  const { allowed, retryAfterSec } = rateLimit(
    `send-password-reset:${getClientIP(request)}`,
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
    const body = await request.json().catch(() => ({}));
    const email = (body?.email ?? "").toString().trim().toLowerCase();
    if (!email) return Response.json({ error: "Correo inválido" }, { status: 400 });

    try {
      const actionLink = await adminAuth.generatePasswordResetLink(email);
      const { subject, html, text } = resetPartnerPasswordTemplate({ actionLink });
      await sendMail({ to: email, subject, html, text });
    } catch (error: any) {
      // auth/user-not-found (o cualquier otro fallo de Firebase para este
      // correo) → no revelar nada, solo no mandar el correo.
      if (error?.code !== "auth/user-not-found") {
        console.error("POST /api/partner/send-password-reset (generar/enviar):", error);
      }
    }

    return Response.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("POST /api/partner/send-password-reset:", error);
    // Aun ante un error inesperado, misma respuesta genérica.
    return Response.json(GENERIC_RESPONSE);
  }
}
