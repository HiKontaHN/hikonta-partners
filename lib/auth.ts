// lib/auth.ts
import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { sql } from "@/lib/db";

// ── Tipos ─────────────────────────────────────────────────────────────

export type PartnerUser = {
  userId: number;
  partnerId: number;
  partnerName: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
};

export type AuthErrorReason = "NOT_PARTNER" | "PENDING_APPROVAL";

type AuthResult =
  | { error: string; status: number; data: null; reason?: AuthErrorReason }
  | { error: null; status: 200; data: PartnerUser };

// ── verifyPartner ─────────────────────────────────────────────────────
// Análogo a verifyAdmin() en yelifin-sistema: valida el Firebase JWT y
// resuelve la identidad contra `partners.user_id`, NO contra
// organization_members — un coordinador de partner es un rol de
// plataforma, no un miembro de ninguna organización.

export async function verifyPartner(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "No autorizado", status: 401, data: null };
  }

  const token = authHeader.substring(7);

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch {
    return { error: "Token inválido o expirado", status: 401, data: null };
  }

  try {
    const [row] = await sql`
      SELECT
        u.id            AS user_id,
        u.firebase_uid,
        u.email,
        u.display_name,
        p.id            AS partner_id,
        p.name          AS partner_name,
        p.is_active     AS partner_is_active
      FROM users u
      JOIN partners p ON p.user_id = u.id
      WHERE u.firebase_uid = ${decodedToken.uid}
      LIMIT 1
    `;

    if (!row) {
      return {
        error: "Esta cuenta no tiene acceso al panel de partners",
        status: 403,
        data: null,
        reason: "NOT_PARTNER",
      };
    }

    if (!row.partner_is_active) {
      // Puede ser un partner recién registrado (esperando aprobación) o uno
      // deshabilitado — desde el cliente se trata igual: "sin acceso todavía".
      return {
        error: "Tu cuenta de partner está pendiente de aprobación",
        status: 403,
        data: null,
        reason: "PENDING_APPROVAL",
      };
    }

    return {
      error: null,
      status: 200,
      data: {
        userId: row.user_id,
        partnerId: row.partner_id,
        partnerName: row.partner_name,
        firebaseUid: row.firebase_uid,
        email: row.email,
        displayName: row.display_name,
      },
    };
  } catch (error) {
    console.error("Error en verifyPartner:", error);
    return { error: "Error interno del servidor", status: 500, data: null };
  }
}

// ── requireOwnedOrganization ─────────────────────────────────────────
// Verifica que orgId esté dentro del portafolio del partner autenticado.
// Uso en rutas [id]: const deny = await requireOwnedOrganization(partner.partnerId, orgId);

export async function requireOwnedOrganization(
  partnerId: number,
  orgId: number
): Promise<Response | null> {
  const [link] = await sql`
    SELECT 1 FROM partner_organizations WHERE partner_id = ${partnerId} AND org_id = ${orgId}
  `;
  if (!link) return createErrorResponse("Emprendedor no encontrado en tu portafolio", 404);
  return null;
}

// ── createErrorResponse ────────────────────────────────────────────────

export function createErrorResponse(error: string, status: number, reason?: AuthErrorReason) {
  return Response.json({ error, ...(reason && { reason }) }, { status });
}

// ── isAuthSuccess ──────────────────────────────────────────────────────

export function isAuthSuccess(
  result: Awaited<ReturnType<typeof verifyPartner>>
): result is { error: null; status: 200; data: PartnerUser } {
  return result.error === null;
}
