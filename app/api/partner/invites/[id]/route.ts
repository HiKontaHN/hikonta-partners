import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// Cancela un código todavía sin usar — no lo borra, lo marca revoked_at
// para conservar el historial (ver GET /api/partner/invites).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const inviteId = Number((await params).id);
  if (!Number.isFinite(inviteId)) return createErrorResponse("Id inválido", 400);

  try {
    const [revoked] = await sql`
      UPDATE partner_invite_codes
      SET revoked_at = NOW()
      WHERE id = ${inviteId} AND partner_id = ${auth.data.partnerId}
        AND used_at IS NULL AND revoked_at IS NULL
      RETURNING id
    `;

    if (!revoked) {
      return createErrorResponse("Código no encontrado, ya usado o ya cancelado", 404);
    }

    return Response.json({ message: "Código cancelado" });
  } catch (error) {
    console.error("DELETE /api/partner/invites/[id]:", error);
    return createErrorResponse("Error al cancelar el código", 500);
  }
}
