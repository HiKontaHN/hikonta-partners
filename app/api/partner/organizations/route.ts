import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// Mismos umbrales que /api/partner/dashboard — ver documentation/dashboard.md.
const ACTIVE_DAYS = 30;
const DORMANT_DAYS = 90;

export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = 10; // paginación estándar de HiKonta
    const offset = (page - 1) * limit;

    const orgs = await sql`
      SELECT
        o.id,
        o.name,
        o.logo_url,
        o.created_at,
        po.share_financials,
        u.display_name AS owner_name,
        u.email        AS owner_email,
        i.name          AS industry_name,
        os.status       AS subscription_status,
        sp.name         AS plan_name,
        (SELECT COUNT(*) FROM sales s WHERE s.org_id = o.id
           AND DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', NOW())) AS sales_this_month,
        (SELECT COALESCE(SUM(total), 0) FROM sales s WHERE s.org_id = o.id
           AND DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', NOW())) AS income_this_month,
        (SELECT COALESCE(SUM(total), 0) FROM sales s WHERE s.org_id = o.id
           AND DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')) AS income_last_month,
        GREATEST(
          COALESCE((SELECT MAX(sold_at)     FROM sales        WHERE org_id = o.id), o.created_at),
          COALESCE((SELECT MAX(occurred_at) FROM transactions WHERE org_id = o.id), o.created_at)
        ) AS last_activity_at
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      LEFT JOIN users u ON u.id = o.owner_user_id
      LEFT JOIN industries i ON i.id = o.industry_id
      LEFT JOIN org_subscriptions os ON os.org_id = o.id
      LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
      ORDER BY o.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ total }] = await sql`
      SELECT COUNT(*)::int AS total FROM partner_organizations WHERE partner_id = ${auth.data.partnerId}
    `;

    const now = Date.now();
    const daysSince = (d: string) => (now - new Date(d).getTime()) / 86_400_000;

    const data = orgs.map((o: any) => {
      const sinceActivity = daysSince(o.last_activity_at);
      const daysActive = Math.floor(daysSince(o.created_at));
      const status: "ACTIVE" | "INACTIVE" | "DORMANT" =
        sinceActivity <= ACTIVE_DAYS ? "ACTIVE" : sinceActivity <= DORMANT_DAYS ? "INACTIVE" : "DORMANT";

      const shareFinancials = o.share_financials === true;
      const incomeThisMonth = Number(o.income_this_month);
      const incomeLastMonth = Number(o.income_last_month);
      const trendPct = incomeLastMonth > 0 ? ((incomeThisMonth - incomeLastMonth) / incomeLastMonth) * 100 : null;

      return {
        id: o.id,
        name: o.name,
        logoUrl: o.logo_url,
        ownerName: o.owner_name,
        ownerEmail: o.owner_email,
        industryName: o.industry_name,
        joinedAt: o.created_at,
        daysActive,
        subscriptionStatus: o.subscription_status,
        planName: o.plan_name,
        salesThisMonth: Number(o.sales_this_month),
        lastActivityAt: o.last_activity_at,
        status,
        // Ingresos/tendencia: null si la org no autorizó compartir montos —
        // el cliente muestra "—", nunca inventa un valor.
        shareFinancials,
        incomeThisMonth: shareFinancials ? incomeThisMonth : null,
        incomeTrendPct: shareFinancials && trendPct !== null ? Number(trendPct.toFixed(1)) : null,
      };
    });

    return Response.json({ data, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("GET /api/partner/organizations:", error);
    return createErrorResponse("Error al obtener organizaciones", 500);
  }
}
