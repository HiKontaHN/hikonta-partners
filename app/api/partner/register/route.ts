import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { sql } from "@/lib/db";
import { createErrorResponse } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { hasValidRequestOrigin } from "@/lib/request-origin";

// POST /api/partner/register — pública, sin verifyPartner().
// Crea el usuario en Firebase + su fila en `users` + su fila en `partners`
// con is_active = FALSE (queda pendiente de aprobación manual por HiKonta,
// que también es quien vincula las organizaciones del portafolio vía
// partner_organizations — ver database/docs/partner-dashboard-architecture.md
// en yelifin-sistema, sección "Preguntas abiertas").
export async function POST(request: NextRequest) {
  try {
    if (!hasValidRequestOrigin(request)) {
      return createErrorResponse("Origen no autorizado", 403);
    }
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
      dateOfBirth,
      password,
    }: {
      incubatorName?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      dateOfBirth?: string;
      password?: string;
    } = await request.json();

    if (!incubatorName?.trim()) return createErrorResponse("El nombre de la incubadora es requerido", 400);
    if (!contactName?.trim()) return createErrorResponse("El nombre de contacto es requerido", 400);
    if (!email?.trim()) return createErrorResponse("El correo es requerido", 400);
    if (!dateOfBirth) return createErrorResponse("La fecha de nacimiento es requerida", 400);

    // Se comprueba nuevamente en el servidor y no se persiste. El portal es
    // un servicio empresarial para adultos y no debe recopilar datos de menores.
    const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
    const today = new Date();
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
      Number.isNaN(birthDate.getTime()) ||
      birthDate.toISOString().slice(0, 10) !== dateOfBirth ||
      birthDate > today
    ) {
      return createErrorResponse("Fecha de nacimiento inválida", 400);
    }

    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const birthdayPending =
      today.getUTCMonth() < birthDate.getUTCMonth() ||
      (today.getUTCMonth() === birthDate.getUTCMonth() &&
        today.getUTCDate() < birthDate.getUTCDate());
    if (birthdayPending) age -= 1;

    if (age < 18) {
      const response = NextResponse.json(
        { error: "Debes tener al menos 18 años para crear una cuenta" },
        { status: 403 },
      );
      response.cookies.set("hikonta_partner_age_ineligible", "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60,
        path: "/",
      });
      return response;
    }

    if (request.cookies.get("hikonta_partner_age_ineligible")?.value === "1") {
      return createErrorResponse("No se puede completar el registro con esta sesión", 403);
    }

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
