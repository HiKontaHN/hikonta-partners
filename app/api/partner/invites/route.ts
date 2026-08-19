import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { generateInviteCode, INVITE_CODE_DEFAULT_EXPIRY_DAYS } from "@/lib/invite-codes";

// Códigos de invitación para sumar organizaciones al portafolio (ver
// database/partners/04-invite-codes.sql en yelifin-sistema — pregunta
// abierta 6 de partner-dashboard-architecture.md). El canje real (crear el
// vínculo en partner_organizations) pasa del lado de yelifin-sistema
// (/api/auth/register y /api/organization/link-partner); acá solo se
// generan, listan y revocan.

function deriveStatus(row: any): "ACTIVE" | "USED" | "EXPIRED" | "REVOKED" {
  if (row.revoked_at) return "REVOKED";
  if (row.used_at) return "USED";
  if (new Date(row.expires_at).getTime() < Date.now()) return "EXPIRED";
  return "ACTIVE";
}

export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const rows = await sql`
      SELECT ic.id, ic.code, ic.expires_at, ic.revoked_at, ic.used_at, ic.created_at,
        o.id AS used_by_org_id, o.name AS used_by_org_name
      FROM partner_invite_codes ic
      LEFT JOIN organizations o ON o.id = ic.used_by_org_id
      WHERE ic.partner_id = ${auth.data.partnerId}
      ORDER BY ic.created_at DESC
      LIMIT 50
    `;

    return Response.json({
      data: (rows as any[]).map((r) => ({
        id: r.id,
        code: r.code,
        status: deriveStatus(r),
        expiresAt: r.expires_at,
        usedAt: r.used_at,
        usedByOrgId: r.used_by_org_id,
        usedByOrgName: r.used_by_org_name,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/partner/invites:", error);
    return createErrorResponse("Error al obtener los códigos", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    // Reintenta en la rarísima colisión contra el UNIQUE de `code` — 8
    // caracteres sobre un charset de 32 da ~1.1 billones de combinaciones,
    // esto es solo defensivo.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      try {
        // `|| null` en vez de auth.data.userId directo: en modo BYPASS_AUTH
        // (ver lib/auth.ts) userId es 0, un id que no existe en `users` —
        // insertarlo tal cual violaría la FK created_by_user_id.
        const [row] = await sql`
          INSERT INTO partner_invite_codes (partner_id, code, created_by_user_id, expires_at)
          VALUES (
            ${auth.data.partnerId}, ${code}, ${auth.data.userId || null},
            NOW() + INTERVAL '1 day' * ${INVITE_CODE_DEFAULT_EXPIRY_DAYS}
          )
          RETURNING id, code, expires_at, created_at
        `;
        return Response.json(
          {
            data: {
              id: row.id,
              code: row.code,
              status: "ACTIVE" as const,
              expiresAt: row.expires_at,
              usedAt: null,
              usedByOrgId: null,
              usedByOrgName: null,
              createdAt: row.created_at,
            },
          },
          { status: 201 }
        );
      } catch (err: any) {
        if (err?.code === "23505") continue; // unique_violation en `code` — reintentar
        throw err;
      }
    }
    return createErrorResponse("No se pudo generar un código único, intenta de nuevo", 500);
  } catch (error) {
    console.error("POST /api/partner/invites:", error);
    return createErrorResponse("Error al generar el código", 500);
  }
}
