import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess, requireOwnedOrganization } from "@/lib/auth";
import { sql } from "@/lib/db";
import { computeImpact } from "@/lib/impact";

const WEEKS = 8;
const MONTHS = 12;
const RECENT_SALES = 8;

// Mismos umbrales que /api/partner/organizations y /api/partner/dashboard —
// ver documentation/dashboard.md.
const ACTIVE_DAYS = 30;
const DORMANT_DAYS = 90;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const orgId = Number((await params).id);
  if (!Number.isFinite(orgId)) return createErrorResponse("Id inválido", 400);

  const deny = await requireOwnedOrganization(auth.data.partnerId, orgId);
  if (deny) return deny;

  try {
    const [org] = await sql`
      SELECT
        o.id, o.name, o.logo_url, o.created_at, o.timezone, o.currency,
        po.share_financials, po.linked_at,
        u.display_name AS owner_name, u.email AS owner_email,
        i.name AS industry_name,
        os.plan_id, os.status AS subscription_status, os.current_period_end,
        sp.name   AS plan_name,
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
      WHERE o.id = ${orgId}
    `;

    if (!org) return createErrorResponse("Organización no encontrada", 404);

    const sinceActivity = (Date.now() - new Date(org.last_activity_at).getTime()) / 86_400_000;
    const status: "ACTIVE" | "INACTIVE" | "DORMANT" =
      sinceActivity <= ACTIVE_DAYS ? "ACTIVE" : sinceActivity <= DORMANT_DAYS ? "INACTIVE" : "DORMANT";

    const [counts] = await sql`
      SELECT
        (SELECT COUNT(*) FROM sales        WHERE org_id = ${orgId}) AS total_sales,
        (SELECT COUNT(*) FROM products     WHERE org_id = ${orgId} AND is_active = TRUE) AS total_products,
        (SELECT COUNT(*) FROM customers    WHERE org_id = ${orgId}) AS total_customers,
        (SELECT COUNT(*) FROM sales WHERE org_id = ${orgId}
           AND DATE_TRUNC('month', sold_at) = DATE_TRUNC('month', NOW())) AS sales_this_month
    `;

    // Meses patrocinados por este partner (si aplica)
    const [sponsorship] = await sql`
      SELECT COALESCE(SUM(months_purchased), 0)::int AS months_sponsored
      FROM subscription_payments
      WHERE org_id = ${orgId} AND paid_by_partner_id = ${auth.data.partnerId}
    `;

    // Gráfico "transacciones por semana" (Panel 2 del doc) — conteo, no
    // requiere opt-in financiero, un conteo no revela cuánto factura nadie.
    const weeklyRows = await sql`
      WITH weeks AS (
        SELECT date_trunc('week', now()) - (n || ' weeks')::interval AS week_start
        FROM generate_series(${WEEKS - 1}, 0, -1) AS n
      )
      SELECT w.week_start, COUNT(s.id)::int AS count
      FROM weeks w
      LEFT JOIN sales s ON s.org_id = ${orgId}
        AND s.sold_at >= w.week_start AND s.sold_at < w.week_start + INTERVAL '1 week'
      GROUP BY w.week_start
      ORDER BY w.week_start
    `;

    // Impacto del partner: crecimiento en actividad (ventas + transacciones,
    // SIN montos) comparando el promedio mensual ANTES de vincularse a este
    // portafolio vs DESPUÉS — ver lib/impact.ts. Nunca requiere
    // share_financials: es puro conteo, no revela cuánto factura nadie.
    const linkedAt = org.linked_at;
    const [impactCounts] = await sql`
      SELECT
        (
          (SELECT COUNT(*) FROM sales        WHERE org_id = ${orgId} AND sold_at     >= ${org.created_at}::timestamptz AND sold_at     < ${linkedAt}::timestamptz) +
          (SELECT COUNT(*) FROM transactions WHERE org_id = ${orgId} AND occurred_at >= ${org.created_at}::timestamptz AND occurred_at < ${linkedAt}::timestamptz)
        )::int AS before_count,
        (
          (SELECT COUNT(*) FROM sales        WHERE org_id = ${orgId} AND sold_at     >= ${linkedAt}::timestamptz) +
          (SELECT COUNT(*) FROM transactions WHERE org_id = ${orgId} AND occurred_at >= ${linkedAt}::timestamptz)
        )::int AS after_count
    `;
    const daysBefore = (new Date(linkedAt).getTime() - new Date(org.created_at).getTime()) / 86_400_000;
    const daysAfter = (Date.now() - new Date(linkedAt).getTime()) / 86_400_000;
    const impact = computeImpact({
      beforeCount: Number(impactCounts.before_count),
      afterCount: Number(impactCounts.after_count),
      daysBefore,
      daysAfter,
    });

    // Tendencia reciente de actividad (este mes vs anterior) — detalle de
    // apoyo al número de impacto de arriba, mismo conteo ventas+transacciones,
    // tampoco requiere share_financials.
    const monthlyActivityRows = await sql`
      WITH months AS (
        SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
        FROM generate_series(${MONTHS - 1}, 0, -1) AS n
      ),
      monthly_sales AS (
        SELECT m.month_start, COUNT(s.id)::int AS sales_count
        FROM months m
        LEFT JOIN sales s ON s.org_id = ${orgId}
          AND s.sold_at >= m.month_start AND s.sold_at < m.month_start + INTERVAL '1 month'
        GROUP BY m.month_start
      ),
      monthly_tx AS (
        SELECT m.month_start, COUNT(t.id)::int AS tx_count
        FROM months m
        LEFT JOIN transactions t ON t.org_id = ${orgId}
          AND t.occurred_at >= m.month_start AND t.occurred_at < m.month_start + INTERVAL '1 month'
        GROUP BY m.month_start
      )
      SELECT ms.month_start, ms.sales_count + mt.tx_count AS count
      FROM monthly_sales ms
      JOIN monthly_tx mt ON mt.month_start = ms.month_start
      ORDER BY ms.month_start
    `;
    const monthlyActivity = (monthlyActivityRows as any[]).map((r) => Number(r.count));
    const activityThisMonth = monthlyActivity[monthlyActivity.length - 1] ?? 0;
    const activityLastMonth = monthlyActivity[monthlyActivity.length - 2] ?? 0;
    const activityTrendPct = activityLastMonth > 0
      ? Number((((activityThisMonth - activityLastMonth) / activityLastMonth) * 100).toFixed(1))
      : null;

    // Histórico de ingresos vs ganancias (12 meses) — SOLO si la org
    // autorizó compartir montos (share_financials), mismo gate que el
    // resto del panel. Ganancia = line_total - costo - impuesto
    // proporcional, misma fórmula que "Ventas vs Ganancias" en
    // yelifin-sistema (comparten la misma base Neon, ver lib/db.ts).
    // Ingreso y ganancia se calculan en CTEs separados: unirlos en un solo
    // JOIN contra sale_items multiplicaría s.total por cada línea de venta.
    const shareFinancials = org.share_financials === true;
    const monthlyIncomeRows = shareFinancials
      ? await sql`
          WITH months AS (
            SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
            FROM generate_series(${MONTHS - 1}, 0, -1) AS n
          ),
          monthly_income AS (
            SELECT m.month_start, COALESCE(SUM(s.total), 0) AS income
            FROM months m
            LEFT JOIN sales s ON s.org_id = ${orgId}
              AND s.sold_at >= m.month_start AND s.sold_at < m.month_start + INTERVAL '1 month'
            GROUP BY m.month_start
          ),
          monthly_profit AS (
            SELECT m.month_start, COALESCE(SUM(
              si.line_total
              - (si.unit_cost * si.quantity)
              - COALESCE(
                  CASE
                    WHEN (s.subtotal - s.discount) > 0
                    THEN (s.tax * si.line_total / (s.subtotal - s.discount))
                    ELSE 0
                  END,
                  0
                )
            ), 0) AS profit
            FROM months m
            LEFT JOIN sales s ON s.org_id = ${orgId}
              AND s.sold_at >= m.month_start AND s.sold_at < m.month_start + INTERVAL '1 month'
            LEFT JOIN sale_items si ON si.sale_id = s.id AND si.org_id = s.org_id
            GROUP BY m.month_start
          )
          SELECT mi.month_start, mi.income, mp.profit
          FROM monthly_income mi
          JOIN monthly_profit mp ON mp.month_start = mi.month_start
          ORDER BY mi.month_start
        `
      : [];

    const recentSalesRows = await sql`
      SELECT id, sale_number, sold_at, total, status
      FROM sales
      WHERE org_id = ${orgId}
      ORDER BY sold_at DESC
      LIMIT ${RECENT_SALES}
    `;

    // Montos financieros: solo si share_financials = TRUE (ver arquitectura)
    const monthlyIncome = (monthlyIncomeRows as any[]).map((r) => ({
      month: new Date(r.month_start).toISOString().slice(0, 7),
      income: Number(r.income),
      profit: Number(r.profit),
    }));

    // Tendencia % (este mes vs anterior) para ingresos y ganancias — mismo
    // cálculo que /api/partner/dashboard y /api/partner/organizations, pero
    // derivado de monthlyIncome (ya trae los últimos 12 meses ordenados
    // ascendente) en vez de otra query: el mes actual es el último elemento,
    // el anterior el penúltimo.
    const currentMonth = monthlyIncome[monthlyIncome.length - 1] ?? null;
    const previousMonth = monthlyIncome[monthlyIncome.length - 2] ?? null;
    const pctChange = (curr: number, prev: number) =>
      prev > 0 ? Number((((curr - prev) / prev) * 100).toFixed(1)) : null;

    return Response.json({
      data: {
        id: org.id,
        name: org.name,
        logoUrl: org.logo_url,
        createdAt: org.created_at,
        timezone: org.timezone,
        currency: org.currency,
        shareFinancials,
        linkedAt: org.linked_at,
        ownerName: org.owner_name,
        ownerEmail: org.owner_email,
        industryName: org.industry_name,
        subscriptionStatus: org.subscription_status,
        currentPeriodEnd: org.current_period_end,
        planId: org.plan_id,
        planName: org.plan_name,
        lastActivityAt: org.last_activity_at,
        status,
        counts: {
          totalSales: Number(counts.total_sales),
          totalProducts: Number(counts.total_products),
          totalCustomers: Number(counts.total_customers),
          salesThisMonth: Number(counts.sales_this_month),
        },
        monthsSponsored: sponsorship.months_sponsored,
        weeklyTransactions: (weeklyRows as any[]).map((r) => ({
          weekStart: new Date(r.week_start).toISOString().slice(0, 10),
          count: r.count,
        })),
        // Impacto: crecimiento en actividad desde que se unió al portafolio
        // (sin montos, ver lib/impact.ts) — lo que más le importa al partner.
        impact: {
          beforeAvgMonthly: impact.beforeAvgMonthly,
          afterAvgMonthly: impact.afterAvgMonthly,
          growthPct: impact.growthPct,
          hasBaseline: impact.hasBaseline,
          startedFromZero: impact.startedFromZero,
        },
        activityTrendPct,
        monthlyIncome,
        // Este mes vs mes anterior — null si la org no comparte montos o no
        // hay mes anterior con datos para comparar (nunca se inventa un %).
        incomeThisMonth: shareFinancials ? (currentMonth?.income ?? 0) : null,
        incomeTrendPct:
          shareFinancials && currentMonth && previousMonth
            ? pctChange(currentMonth.income, previousMonth.income)
            : null,
        profitThisMonth: shareFinancials ? (currentMonth?.profit ?? 0) : null,
        profitTrendPct:
          shareFinancials && currentMonth && previousMonth
            ? pctChange(currentMonth.profit, previousMonth.profit)
            : null,
        recentSales: (recentSalesRows as any[]).map((s) => ({
          id: s.id,
          saleNumber: s.sale_number,
          soldAt: s.sold_at,
          status: s.status,
          total: shareFinancials ? Number(s.total) : null,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/partner/organizations/[id]:", error);
    return createErrorResponse("Error al obtener la organización", 500);
  }
}
