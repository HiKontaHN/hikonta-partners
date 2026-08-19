import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

const ACTIVE_WINDOW_DAYS = 30;

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

    const cutoff = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000);
    const activeCount = orgs.filter((o: any) => new Date(o.last_activity_at) >= cutoff).length;
    const total = orgs.length;
    const adoptionRate = total > 0 ? (activeCount / total) * 100 : 0;

    // ── Reporte para terceros — sección 19 de ideas-feasibility.md ───────
    // Beneficiarios = total de emprendimientos del portafolio (arriba).
    // Ventas generadas = histórico completo, no solo el mes — SOLO de orgs
    // con share_financials = TRUE (mismo gate que el resto del panel).
    // Sectores beneficiados = distribución por industry_id.
    const [salesTotal] = await sql`
      SELECT COALESCE(SUM(s.total), 0) AS total_sales
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id
        AND po.partner_id = ${auth.data.partnerId} AND po.share_financials = TRUE
      LEFT JOIN sales s ON s.org_id = o.id
    `;

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
        totalEnrolled: total,
        activeUsers: activeCount,
        inactiveUsers: total - activeCount,
        adoptionRate: Number(adoptionRate.toFixed(2)),
        period: `Últimos ${ACTIVE_WINDOW_DAYS} días`,
        recommendation: adoptionRate > 70 ? "GOOD" : adoptionRate > 50 ? "MODERATE" : "NEEDS_ATTENTION",
        impact: {
          beneficiaries: total,
          totalSalesGenerated: Number(salesTotal.total_sales),
          sectorsBenefited: (sectorRows as any[]).map((s) => ({
            industryId: s.industry_id,
            industryName: s.industry_name ?? "Sin sector",
            count: s.count,
            pct: total > 0 ? Number(((s.count / total) * 100).toFixed(1)) : 0,
          })),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/partner/reports/adoption:", error);
    return createErrorResponse("Error al obtener el reporte de adopción", 500);
  }
}
