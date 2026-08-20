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
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "all"; // all | ACTIVE | INACTIVE | DORMANT
    const industry = searchParams.get("industry") ?? "all"; // all | none | <industry_id>
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    // 12 en vez de los 10 "estándar" del resto del panel (ver
    // subscriptions/payments) — divide parejo en el grid de cards a 2/3/4
    // columnas, una tabla no tenía esa restricción.
    const limit = 12;
    const offset = (page - 1) * limit;
    const searchPattern = `%${search}%`;

    // `status` se deriva de last_activity_at igual que en el dashboard, pero
    // acá hace falta calcularlo EN SQL (no en JS después de traer la fila)
    // para poder filtrar y paginar sobre el resultado ya filtrado. neon()
    // no soporta fragmentos de SQL reutilizables (cada template se ejecuta
    // solo), así que el WHERE se repite en la query de datos y en la de
    // COUNT — mismo patrón que subscriptions/payments/route.ts.
    const orgs = await sql`
      WITH portfolio AS (
        SELECT
          o.id, o.name, o.logo_url, o.created_at, o.industry_id,
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
      ),
      filtered AS (
        SELECT *,
          CASE
            WHEN NOW() - last_activity_at <= INTERVAL '1 day' * ${ACTIVE_DAYS} THEN 'ACTIVE'
            WHEN NOW() - last_activity_at <= INTERVAL '1 day' * ${DORMANT_DAYS} THEN 'INACTIVE'
            ELSE 'DORMANT'
          END AS status
        FROM portfolio
      )
      SELECT * FROM filtered
      WHERE (${search} = '' OR name ILIKE ${searchPattern} OR owner_name ILIKE ${searchPattern} OR owner_email ILIKE ${searchPattern})
        AND (${status} = 'all' OR status = ${status})
        AND (
          ${industry} = 'all'
          OR (${industry} = 'none' AND industry_id IS NULL)
          OR industry_id::text = ${industry}
        )
      ORDER BY name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ total }] = await sql`
      WITH portfolio AS (
        SELECT
          o.id, o.industry_id,
          u.display_name AS owner_name,
          u.email        AS owner_email,
          GREATEST(
            COALESCE((SELECT MAX(sold_at)     FROM sales        WHERE org_id = o.id), o.created_at),
            COALESCE((SELECT MAX(occurred_at) FROM transactions WHERE org_id = o.id), o.created_at)
          ) AS last_activity_at,
          o.name
        FROM organizations o
        JOIN partner_organizations po ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
        LEFT JOIN users u ON u.id = o.owner_user_id
      ),
      filtered AS (
        SELECT *,
          CASE
            WHEN NOW() - last_activity_at <= INTERVAL '1 day' * ${ACTIVE_DAYS} THEN 'ACTIVE'
            WHEN NOW() - last_activity_at <= INTERVAL '1 day' * ${DORMANT_DAYS} THEN 'INACTIVE'
            ELSE 'DORMANT'
          END AS status
        FROM portfolio
      )
      SELECT COUNT(*)::int AS total FROM filtered
      WHERE (${search} = '' OR name ILIKE ${searchPattern} OR owner_name ILIKE ${searchPattern} OR owner_email ILIKE ${searchPattern})
        AND (${status} = 'all' OR status = ${status})
        AND (
          ${industry} = 'all'
          OR (${industry} = 'none' AND industry_id IS NULL)
          OR industry_id::text = ${industry}
        )
    `;

    const data = (orgs as any[]).map((o) => {
      const daysActive = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86_400_000);
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
        industryId: o.industry_id,
        industryName: o.industry_name,
        joinedAt: o.created_at,
        daysActive,
        subscriptionStatus: o.subscription_status,
        planName: o.plan_name,
        salesThisMonth: Number(o.sales_this_month),
        lastActivityAt: o.last_activity_at,
        status: o.status as "ACTIVE" | "INACTIVE" | "DORMANT",
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
