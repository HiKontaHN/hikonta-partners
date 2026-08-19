import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// GET /api/partner/credits — lotes de créditos de suscripción que HiKonta
// le facturó a ESTE partner (comprados por adelantado, sin organización
// asignada todavía) — ver POST /api/admin/partners/[id]/credit-batches en
// hikonta-admin, que es donde se generan; acá solo se leen, es de solo
// lectura a propósito: el lote lo arma un admin de HiKonta, no el partner
// (mismo criterio que la sección 10 de documentation/progress.md en
// hikonta-admin). Repartir cada crédito por link o email a alguien sin
// cuenta todavía es la fase 2, sin construir — ver
// hikonta-admin/documentation/feature-sponsorship-invites.md.
export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const rows = await sql`
      SELECT
        b.id, b.months, b.quantity, b.list_unit_price_usd, b.unit_price_usd,
        b.total_usd, b.currency, b.created_at,
        p.name AS plan_name,
        COUNT(*) FILTER (WHERE c.status = 'PENDING') ::int AS pending_count,
        COUNT(*) FILTER (WHERE c.status = 'CLAIMED') ::int AS claimed_count,
        COUNT(*) FILTER (WHERE c.status = 'REVOKED') ::int AS revoked_count
      FROM partner_credit_batches b
      JOIN subscription_plans p ON p.id = b.plan_id
      LEFT JOIN partner_subscription_credits c ON c.batch_id = b.id
      WHERE b.partner_id = ${auth.data.partnerId}
      GROUP BY b.id, p.name
      ORDER BY b.created_at DESC
    `;

    // Postgres numeric vuelve como string sobre HTTP (driver de Neon) — se
    // castea acá, mismo criterio que amountUsd en subscriptions/payments.
    const batches = (rows as any[]).map((b) => ({
      ...b,
      list_unit_price_usd: Number(b.list_unit_price_usd),
      unit_price_usd: Number(b.unit_price_usd),
      total_usd: Number(b.total_usd),
    }));

    const totals = batches.reduce(
      (acc, b) => ({
        pending: acc.pending + b.pending_count,
        claimed: acc.claimed + b.claimed_count,
      }),
      { pending: 0, claimed: 0 }
    );

    return Response.json({ data: batches, totals });
  } catch (error) {
    console.error("GET /api/partner/credits:", error);
    return createErrorResponse("Error al obtener los créditos", 500);
  }
}
