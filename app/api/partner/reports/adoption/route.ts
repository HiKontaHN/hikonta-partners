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

    return Response.json({
      data: {
        totalEnrolled: total,
        activeUsers: activeCount,
        inactiveUsers: total - activeCount,
        adoptionRate: Number(adoptionRate.toFixed(2)),
        period: `Últimos ${ACTIVE_WINDOW_DAYS} días`,
        recommendation: adoptionRate > 70 ? "GOOD" : adoptionRate > 50 ? "MODERATE" : "NEEDS_ATTENTION",
      },
    });
  } catch (error) {
    console.error("GET /api/partner/reports/adoption:", error);
    return createErrorResponse("Error al obtener el reporte de adopción", 500);
  }
}
