import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { sql } from "@/lib/db";
import { createErrorResponse } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

// POST /api/partner/register — pública, sin verifyPartner().
// Crea el usuario en Firebase + su fila en `users` + su fila en `partners`
// con is_active = FALSE (queda pendiente de aprobación manual por HiKonta,
// que también es quien vincula las organizaciones del portafolio vía
// partner_organizations — ver database/docs/partner-dashboard-architecture.md
// en yelifin-sistema, sección "Preguntas abiertas").
export async function POST(request: NextRequest) {
  try {
    // Rate limit propio, más estricto que el global de proxy.ts (300/min) —
    // mismo patrón que los endpoints sensibles de hikonta-admin
    // (create-user, add-admin): esta ruta es pública, sin auth, y crea un
    // usuario de Firebase + filas en Postgres por request, así que es el
    // blanco más barato de spamear/abusar de todo el panel de partners.
    const { allowed, retryAfterSec } = rateLimit(
      `register:${getClientIP(request)}`,
      10,
      15 * 60 * 1000,
    );
    if (!allowed) {
      return Response.json(
        { error: "Demasiados intentos de registro. Intentá de nuevo más tarde." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      );
    }

    const {
      incubatorName,
      contactName,
      email,
      phone,
      password,
    }: {
      incubatorName?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      password?: string;
    } = await request.json();

    if (!incubatorName?.trim()) return createErrorResponse("El nombre de la incubadora es requerido", 400);
    if (!contactName?.trim()) return createErrorResponse("El nombre de contacto es requerido", 400);
    if (!email?.trim()) return createErrorResponse("El correo es requerido", 400);
    if (!password || password.length < 6) {
      return createErrorResponse("La contraseña debe tener al menos 6 caracteres", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Verificar que no exista ya un partner con ese correo (mensaje más
    //    claro que esperar el error crudo de la UNIQUE constraint).
    const [existingPartner] = await sql`SELECT id FROM partners WHERE email = ${normalizedEmail}`;
    if (existingPartner) {
      return createErrorResponse("Ya existe una cuenta de partner con ese correo", 409);
    }

    // 2. Crear usuario en Firebase
    let fbUser;
    try {
      fbUser = await adminAuth.createUser({
        email: normalizedEmail,
        password,
        displayName: contactName.trim(),
        emailVerified: false,
        disabled: false,
      });
    } catch (fbErr: any) {
      const msg =
        fbErr.code === "auth/email-already-exists"
          ? "Ya existe una cuenta con ese correo"
          : (fbErr.message ?? "Error al crear la cuenta");
      return createErrorResponse(msg, 409);
    }

    // 3. Crear users + partners en Postgres. Si algo falla, se revierte el
    //    usuario de Firebase para no dejar una cuenta huérfana.
    try {
      const [user] = await sql`
        INSERT INTO users (firebase_uid, email, display_name, is_active)
        VALUES (${fbUser.uid}, ${normalizedEmail}, ${contactName.trim()}, TRUE)
        RETURNING id
      `;

      const [partner] = await sql`
        INSERT INTO partners (name, contact_name, email, phone, user_id, is_active)
        VALUES (${incubatorName.trim()}, ${contactName.trim()}, ${normalizedEmail}, ${phone?.trim() || null}, ${user.id}, FALSE)
        RETURNING id
      `;

      return Response.json(
        {
          data: {
            partnerId: partner.id,
            pendingApproval: true,
          },
        },
        { status: 201 }
      );
    } catch (dbErr) {
      console.error("POST /api/partner/register — rollback de Firebase por error en DB:", dbErr);
      await adminAuth.deleteUser(fbUser.uid).catch(() => {});
      return createErrorResponse("Error al registrar la cuenta", 500);
    }
  } catch (error) {
    console.error("POST /api/partner/register:", error);
    return createErrorResponse("Error al registrar la cuenta", 500);
  }
}
