import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { pctChange } from "@/lib/growth";

const ACTIVE_WINDOW_DAYS = 30;
const TREND_MONTHS = 6;

// Vista completa de Reportes: adopción, impacto y tendencias en una sola
// autenticación. Los montos de ingreso solo existen dentro de la consulta y
// se convierten a variación porcentual antes de construir la respuesta.
export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const adoptionPromise = sql`
      WITH portfolio AS (
        SELECT o.id, o.created_at
        FROM organizations o
        JOIN partner_organizations po
          ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      ),
      sales_activity AS (
        SELECT s.org_id, MAX(s.sold_at) AS last_sale_at, COUNT(*)::int AS sales_count
        FROM sales s
        JOIN portfolio p ON p.id = s.org_id
        GROUP BY s.org_id
      ),
      transaction_activity AS (
        SELECT t.org_id, MAX(t.occurred_at) AS last_transaction_at
        FROM transactions t
        JOIN portfolio p ON p.id = t.org_id
        GROUP BY t.org_id
      ),
      activity AS (
        SELECT
          p.id,
          GREATEST(
            COALESCE(sa.last_sale_at, p.created_at),
            COALESCE(ta.last_transaction_at, p.created_at)
          ) AS last_activity_at,
          COALESCE(sa.sales_count, 0) AS sales_count
        FROM portfolio p
        LEFT JOIN sales_activity sa ON sa.org_id = p.id
        LEFT JOIN transaction_activity ta ON ta.org_id = p.id
      )
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE last_activity_at >= NOW() - INTERVAL '1 day' * ${ACTIVE_WINDOW_DAYS}
        )::int AS active_count,
        COALESCE(SUM(sales_count), 0)::int AS total_sales
      FROM activity
    `;

    const sectorsPromise = sql`
      SELECT i.id AS industry_id, i.name AS industry_name, COUNT(*)::int AS count
      FROM organizations o
      JOIN partner_organizations po
        ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      LEFT JOIN industries i ON i.id = o.industry_id
      GROUP BY i.id, i.name
      ORDER BY count DESC, industry_name ASC NULLS LAST
    `;

    const trendsPromise = sql`
      WITH months AS (
        SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
        FROM generate_series(${TREND_MONTHS - 1}, 0, -1) AS n
      ),
      portfolio AS (
        SELECT o.id, po.linked_at
        FROM organizations o
        JOIN partner_organizations po ON po.org_id = o.id
        WHERE po.partner_id = ${auth.data.partnerId}
      ),
      enrolled AS (
        SELECT m.month_start, COUNT(*)::int AS enrolled_count
        FROM months m
        JOIN portfolio p ON p.linked_at < m.month_start + INTERVAL '1 month'
        GROUP BY m.month_start
      ),
      monthly_sales AS (
        SELECT
          m.month_start,
          COALESCE(SUM(s.total) FILTER (WHERE s.status = 'COMPLETED'), 0) AS income
        FROM months m
        JOIN portfolio p ON p.linked_at < m.month_start + INTERVAL '1 month'
        LEFT JOIN sales s ON s.org_id = p.id
          AND s.sold_at >= m.month_start
          AND s.sold_at < m.month_start + INTERVAL '1 month'
        GROUP BY m.month_start
      ),
      activity_orgs AS (
        SELECT m.month_start, s.org_id
        FROM months m
        JOIN portfolio p ON p.linked_at < m.month_start + INTERVAL '1 month'
        JOIN sales s ON s.org_id = p.id
          AND s.sold_at >= m.month_start
          AND s.sold_at < m.month_start + INTERVAL '1 month'
        UNION
        SELECT m.month_start, t.org_id
        FROM months m
        JOIN portfolio p ON p.linked_at < m.month_start + INTERVAL '1 month'
        JOIN transactions t ON t.org_id = p.id
          AND t.occurred_at >= m.month_start
          AND t.occurred_at < m.month_start + INTERVAL '1 month'
      ),
      active AS (
        SELECT month_start, COUNT(*)::int AS active_count
        FROM activity_orgs
        GROUP BY month_start
      )
      SELECT
        m.month_start,
        COALESCE(e.enrolled_count, 0) AS enrolled_count,
        COALESCE(a.active_count, 0) AS active_count,
        COALESCE(ms.income, 0) AS income
      FROM months m
      LEFT JOIN enrolled e ON e.month_start = m.month_start
      LEFT JOIN active a ON a.month_start = m.month_start
      LEFT JOIN monthly_sales ms ON ms.month_start = m.month_start
      ORDER BY m.month_start
    `;

    const [adoptionRows, sectorRows, trendRows] = await Promise.all([
      adoptionPromise,
      sectorsPromise,
      trendsPromise,
    ]);

    const summary = (adoptionRows as any[])[0] ?? { total: 0, active_count: 0, total_sales: 0 };
    const total = Number(summary.total);
    const activeCount = Number(summary.active_count);
    const adoptionRate = total > 0 ? (activeCount / total) * 100 : 0;
    const rawIncomes = (trendRows as any[]).map((row) => Number(row.income));

    const trends = (trendRows as any[]).map((row, index) => {
      const enrolled = Number(row.enrolled_count);
      const active = Number(row.active_count);
      return {
        month: new Date(row.month_start).toISOString().slice(0, 7),
        enrolledCount: enrolled,
        activeCount: active,
        adoptionRate: enrolled > 0 ? Number(((active / enrolled) * 100).toFixed(1)) : 0,
        income: index > 0 ? pctChange(rawIncomes[index], rawIncomes[index - 1]) : null,
      };
    });

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
          salesTransactionsGenerated: Number(summary.total_sales),
          sectorsBenefited: (sectorRows as any[]).map((sector) => ({
            industryId: sector.industry_id,
            industryName: sector.industry_name ?? "Sin sector",
            count: sector.count,
            pct: total > 0 ? Number(((Number(sector.count) / total) * 100).toFixed(1)) : 0,
          })),
        },
        trends: { months: trends },
      },
    });
  } catch (error) {
    console.error("GET /api/partner/reports/adoption:", error);
    return createErrorResponse("Error al obtener el reporte de adopción", 500);
  }
}
