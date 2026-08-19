import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// Umbrales de actividad — ver documentation/dashboard.md.
// No hay tracking de login en HiKonta, así que "actividad" se deriva de
// sales/transactions reales (mismo criterio que el resto del panel), no de
// sesiones. ACTIVO ≤30d, INACTIVO 30-90d, DORMANT >90d.
const ACTIVE_DAYS = 30;
const DORMANT_DAYS = 90;

export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const orgs = await sql`
      SELECT
        o.id, o.created_at,
        GREATEST(
          COALESCE((SELECT MAX(sold_at)     FROM sales        WHERE org_id = o.id), o.created_at),
          COALESCE((SELECT MAX(occurred_at) FROM transactions WHERE org_id = o.id), o.created_at)
        ) AS last_activity_at
      FROM organizations o
      WHERE o.id IN (SELECT org_id FROM partner_organizations WHERE partner_id = ${auth.data.partnerId})
    `;

    const now = Date.now();
    const daysSince = (d: string) => (now - new Date(d).getTime()) / 86_400_000;

    let active = 0, inactive = 0, dormant = 0, alerts = 0;
    for (const o of orgs as any[]) {
      const sinceActivity = daysSince(o.last_activity_at);
      const sinceCreated = daysSince(o.created_at);
      if (sinceActivity <= ACTIVE_DAYS) active++;
      else if (sinceActivity <= DORMANT_DAYS) inactive++;
      else dormant++;

      // "En alerta": inactivo/dormant Y no es una org recién creada que
      // todavía no tuvo tiempo de probar la plataforma.
      if (sinceActivity > ACTIVE_DAYS && sinceCreated > ACTIVE_DAYS) alerts++;
    }
    const total = orgs.length;

    // Ingresos: SUM(sales.total) — SOLO de orgs con share_financials = TRUE.
    // El resto del portafolio no entra en la suma (opt-in, ver
    // partner-dashboard-architecture.md). Se compara contra el mes anterior
    // para la tendencia.
    const [income] = await sql`
      SELECT
        COALESCE(SUM(s.total) FILTER (WHERE DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', NOW())), 0) AS this_month,
        COALESCE(SUM(s.total) FILTER (WHERE DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')), 0) AS last_month,
        COUNT(DISTINCT o.id)::int AS orgs_sharing
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id
        AND po.partner_id = ${auth.data.partnerId} AND po.share_financials = TRUE
      LEFT JOIN sales s ON s.org_id = o.id
    `;

    const thisMonthIncome = Number(income.this_month);
    const lastMonthIncome = Number(income.last_month);
    const incomeTrendPct =
      lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : null;

    // Volumen de transacciones (conteo, no monto — no requiere opt-in
    // financiero, un conteo no revela cuánto factura nadie).
    const [txCount] = await sql`
      SELECT COUNT(*)::int AS count
      FROM sales s
      WHERE s.org_id IN (SELECT org_id FROM partner_organizations WHERE partner_id = ${auth.data.partnerId})
        AND DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', NOW())
    `;

    // Distribución por sector/industria — sección 14 de ideas-feasibility.md.
    // GROUP BY sobre industry_id, ya migrado (v4.10) — sin org.industry_id
    // seteado cae en "Sin sector" (i.id IS NULL), no se descarta la fila.
    const sectorRows = await sql`
      SELECT i.id AS industry_id, i.name AS industry_name, COUNT(*)::int AS count
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      LEFT JOIN industries i ON i.id = o.industry_id
      GROUP BY i.id, i.name
      ORDER BY count DESC, industry_name ASC NULLS LAST
    `;

    return Response.json({
      data: {
        partner: auth.data.partnerName,
        summary: {
          totalOrganizations: total,
          activeOrganizations: active,
          inactiveOrganizations: inactive,
          dormantOrganizations: dormant,
          adoptionRate: total > 0 ? Number(((active / total) * 100).toFixed(2)) : 0,
          alertsCount: alerts,
          totalIncomeThisMonth: thisMonthIncome,
          incomeTrendPct: incomeTrendPct !== null ? Number(incomeTrendPct.toFixed(1)) : null,
          incomeOrgsSharing: income.orgs_sharing,
          transactionsThisMonth: txCount.count,
        },
        sectorBreakdown: (sectorRows as any[]).map((s) => ({
          industryId: s.industry_id,
          industryName: s.industry_name ?? "Sin sector",
          count: s.count,
          pct: total > 0 ? Number(((s.count / total) * 100).toFixed(1)) : 0,
        })),
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/partner/dashboard:", error);
    return createErrorResponse("Error al obtener el resumen", 500);
  }
}
