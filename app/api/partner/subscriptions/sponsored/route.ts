import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// Se carga únicamente al abrir la pestaña "Patrocinando". Mantenerlo fuera
// del resumen evita recorrer pagos y suscripciones activas en cada visita a
// la pantalla principal de Suscripciones.
export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const rows = await sql`
      WITH sponsored AS (
        SELECT org_id, COALESCE(SUM(months_purchased), 0)::int AS months_sponsored
        FROM subscription_payments
        WHERE paid_by_partner_id = ${auth.data.partnerId} AND months_purchased > 0
        GROUP BY org_id
      )
      SELECT
        o.id, o.name, o.logo_url,
        sp.name AS plan_name,
        os.current_period_end,
        s.months_sponsored
      FROM organizations o
      JOIN partner_organizations po
        ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      JOIN sponsored s ON s.org_id = o.id
      LEFT JOIN org_subscriptions os ON os.org_id = o.id
      LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
      WHERE os.status = 'ACTIVE'
      ORDER BY os.current_period_end ASC NULLS LAST
    `;

    return Response.json({
      data: (rows as any[]).map((o) => ({
        id: o.id,
        name: o.name,
        logoUrl: o.logo_url,
        planName: o.plan_name,
        currentPeriodEnd: o.current_period_end,
        monthsSponsored: o.months_sponsored,
      })),
    });
  } catch (error) {
    console.error("GET /api/partner/subscriptions/sponsored:", error);
    return createErrorResponse("Error al obtener los patrocinios activos", 500);
  }
}
