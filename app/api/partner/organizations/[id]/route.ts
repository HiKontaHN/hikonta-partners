import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess, requireOwnedOrganization } from "@/lib/auth";
import { sql } from "@/lib/db";
import { computeImpact } from "@/lib/impact";
import { getAvailablePeriodsForOrg, resolveInitialPeriod } from "@/lib/periods";
import { pctChange } from "@/lib/growth";

const WEEKS = 8;
const MONTHS = 12;
const RECENT_SALES = 8;

// Filtro de período del gráfico de ingresos/ganancias (?period=), ver más
// abajo — whitelist cerrada, nunca se interpola texto arbitrario del query
// string en el SQL (unit/unitPlural salen de acá, no del request).
const PERIOD_PRESETS: Record<string, { unit: "day" | "month"; count: number; unitPlural: "days" | "months" }> = {
  "7d": { unit: "day", count: 7, unitPlural: "days" },
  "30d": { unit: "day", count: 30, unitPlural: "days" },
  "3m": { unit: "month", count: 3, unitPlural: "months" },
  "6m": { unit: "month", count: 6, unitPlural: "months" },
  "12m": { unit: "month", count: 12, unitPlural: "months" },
};
const DEFAULT_PERIOD = "12m";

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

  const { searchParams } = new URL(request.url);
  const periodKey = searchParams.get("period") ?? DEFAULT_PERIOD;
  const period = PERIOD_PRESETS[periodKey] ?? PERIOD_PRESETS[DEFAULT_PERIOD];
  // Mes/año de las stat cards "este mes" (ventas, ingresos, ganancias) —
  // ?year=&month=, distinto del `period` de arriba (que es el rango relativo
  // del gráfico de ingresos/ganancias, ej. "12m"). Ver lib/periods.ts.
  try {
    const [orgRows, availablePeriods] = await Promise.all([
      sql`
      SELECT
        o.id, o.name, o.logo_url, o.created_at, o.timezone, o.currency,
        po.linked_at, po.share_financials,
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
      `,
      getAvailablePeriodsForOrg(orgId),
    ]);
    const org = (orgRows as any[])[0];

    if (!org) return createErrorResponse("Emprendedor no encontrado", 404);

    const statsPeriod = resolveInitialPeriod(searchParams, availablePeriods);

    const sinceActivity = (Date.now() - new Date(org.last_activity_at).getTime()) / 86_400_000;
    const status: "ACTIVE" | "INACTIVE" | "DORMANT" =
      sinceActivity <= ACTIVE_DAYS ? "ACTIVE" : sinceActivity <= DORMANT_DAYS ? "INACTIVE" : "DORMANT";

    const linkedAt = org.linked_at;
    // Los cuatro KPIs financieros salen de una sola pasada por `sales`.
    // Costos de productos e insumos se preagregan por venta antes del JOIN:
    // unir ambas tablas 1:N directamente multiplicaría importes y utilidad.
    const monthlyMetricsPromise = sql`
      WITH filtered_sales AS MATERIALIZED (
        SELECT id, subtotal, discount, tax, sold_at
        FROM sales
        WHERE org_id = ${orgId}
          AND status = 'COMPLETED'
          AND sold_at >= ${statsPeriod.periodStart}::date - INTERVAL '1 month'
          AND sold_at < ${statsPeriod.periodStart}::date + INTERVAL '1 month'
      ),
      item_costs AS (
        SELECT si.sale_id, COALESCE(SUM(si.unit_cost * si.quantity), 0) AS cost
        FROM sale_items si
        JOIN filtered_sales fs ON fs.id = si.sale_id
        WHERE si.org_id = ${orgId}
        GROUP BY si.sale_id
      ),
      supply_costs AS (
        SELECT ss.sale_id, COALESCE(SUM(ss.line_total), 0) AS cost
        FROM sale_supplies ss
        JOIN filtered_sales fs ON fs.id = ss.sale_id
        WHERE ss.org_id = ${orgId}
        GROUP BY ss.sale_id
      ),
      monthly_sales AS (
        SELECT
          COALESCE(SUM(s.subtotal) FILTER (
            WHERE s.sold_at >= ${statsPeriod.periodStart}::date
              AND s.sold_at < ${statsPeriod.periodStart}::date + INTERVAL '1 month'
          ), 0) AS gross_income,
          COALESCE(SUM(s.subtotal - s.discount - s.tax) FILTER (
            WHERE s.sold_at >= ${statsPeriod.periodStart}::date
              AND s.sold_at < ${statsPeriod.periodStart}::date + INTERVAL '1 month'
          ), 0) AS net_income,
          COALESCE(SUM(
            (s.subtotal - s.discount - s.tax)
            - COALESCE(ic.cost, 0)
            - COALESCE(sc.cost, 0)
          ) FILTER (
            WHERE s.sold_at >= ${statsPeriod.periodStart}::date
              AND s.sold_at < ${statsPeriod.periodStart}::date + INTERVAL '1 month'
          ), 0) AS utility,
          COUNT(*) FILTER (
            WHERE s.sold_at >= ${statsPeriod.periodStart}::date
              AND s.sold_at < ${statsPeriod.periodStart}::date + INTERVAL '1 month'
          )::int AS sales_count,
          COUNT(*) FILTER (
            WHERE s.sold_at >= ${statsPeriod.periodStart}::date - INTERVAL '1 month'
              AND s.sold_at < ${statsPeriod.periodStart}::date
          )::int AS previous_sales_count
        FROM filtered_sales s
        LEFT JOIN item_costs ic ON ic.sale_id = s.id
        LEFT JOIN supply_costs sc ON sc.sale_id = s.id
      )
      SELECT
        ms.*,
        (SELECT COALESCE(SUM(months_purchased), 0)::int
           FROM subscription_payments
           WHERE org_id = ${orgId} AND paid_by_partner_id = ${auth.data.partnerId}) AS months_sponsored,
        (
          (SELECT COUNT(*) FROM sales WHERE org_id = ${orgId} AND status = 'COMPLETED'
             AND sold_at >= ${org.created_at}::timestamptz AND sold_at < ${linkedAt}::timestamptz) +
          (SELECT COUNT(*) FROM transactions
             WHERE org_id = ${orgId} AND occurred_at >= ${org.created_at}::timestamptz AND occurred_at < ${linkedAt}::timestamptz)
        )::int AS before_count,
        (
          (SELECT COUNT(*) FROM sales WHERE org_id = ${orgId} AND status = 'COMPLETED'
             AND sold_at >= ${linkedAt}::timestamptz) +
          (SELECT COUNT(*) FROM transactions WHERE org_id = ${orgId} AND occurred_at >= ${linkedAt}::timestamptz)
        )::int AS after_count
      FROM monthly_sales ms
    `;

    // Gráfico "transacciones por semana" (Panel 2 del doc) — conteo, no
    // requiere opt-in financiero, un conteo no revela cuánto factura nadie.
    const weeklyRowsPromise = sql`
      WITH weeks AS (
        SELECT date_trunc('week', now()) - (n || ' weeks')::interval AS week_start
        FROM generate_series(${WEEKS - 1}, 0, -1) AS n
      )
      SELECT w.week_start, COUNT(s.id)::int AS count
      FROM weeks w
      LEFT JOIN sales s ON s.org_id = ${orgId} AND s.status = 'COMPLETED'
        AND s.sold_at >= w.week_start AND s.sold_at < w.week_start + INTERVAL '1 week'
      GROUP BY w.week_start
      ORDER BY w.week_start
    `;

    // Tendencia reciente de actividad (este mes vs anterior) — detalle de
    // apoyo al número de impacto de arriba, mismo conteo ventas+transacciones,
    // tampoco requiere share_financials.
    const monthlyActivityRowsPromise = sql`
      WITH months AS (
        SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
        FROM generate_series(${MONTHS - 1}, 0, -1) AS n
      ),
      monthly_sales AS (
        SELECT m.month_start, COUNT(s.id)::int AS sales_count
        FROM months m
        LEFT JOIN sales s ON s.org_id = ${orgId} AND s.status = 'COMPLETED'
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

    // Gráfico de ingreso neto vs utilidad — usa las mismas definiciones de
    // los KPIs. Los costos se preagregan por venta para evitar multiplicar
    // importes al cruzar productos e insumos. `unit`/`unitPlural` salen de
    // PERIOD_PRESETS (whitelist arriba), nunca del query string directo —
    // es seguro concatenarlos en el SQL.
    // `s.status = 'COMPLETED'` en ambas CTEs: yelifin-sistema (lo que ve el
    // emprendedor en su propio dashboard) SIEMPRE filtra a solo ventas
    // completadas antes de sumar (ver app/api/dashboard/route.ts ahí). Sin
    // este filtro acá, ventas PENDING/CANCELLED se sumaban también y el %
    // que veía el partner no cuadraba con el ingreso/ganancia real del
    // emprendedor.
    const financialRowsPromise = org.share_financials === true
      ? sql`
      WITH periods AS (
        SELECT date_trunc(${period.unit}, now()) - (n || ' ' || ${period.unitPlural})::interval AS period_start
        FROM generate_series(${period.count - 1}, 0, -1) AS n
      ),
      filtered_sales AS MATERIALIZED (
        SELECT s.id, s.subtotal, s.discount, s.tax, s.sold_at
        FROM sales s
        WHERE s.org_id = ${orgId}
          AND s.status = 'COMPLETED'
          AND s.sold_at >= (SELECT MIN(period_start) FROM periods)
          AND s.sold_at < (
            SELECT MAX(period_start) + ('1 ' || ${period.unitPlural})::interval
            FROM periods
          )
      ),
      item_costs AS (
        SELECT si.sale_id, COALESCE(SUM(si.unit_cost * si.quantity), 0) AS cost
        FROM sale_items si
        JOIN filtered_sales fs ON fs.id = si.sale_id
        WHERE si.org_id = ${orgId}
        GROUP BY si.sale_id
      ),
      supply_costs AS (
        SELECT ss.sale_id, COALESCE(SUM(ss.line_total), 0) AS cost
        FROM sale_supplies ss
        JOIN filtered_sales fs ON fs.id = ss.sale_id
        WHERE ss.org_id = ${orgId}
        GROUP BY ss.sale_id
      ),
      period_financials AS (
        SELECT
          p.period_start,
          COALESCE(SUM(s.subtotal - s.discount - s.tax), 0) AS income,
          COALESCE(SUM(
            (s.subtotal - s.discount - s.tax)
            - COALESCE(ic.cost, 0)
            - COALESCE(sc.cost, 0)
          ), 0) AS profit
        FROM periods p
        LEFT JOIN filtered_sales s
          ON s.sold_at >= p.period_start AND s.sold_at < p.period_start + ('1 ' || ${period.unitPlural})::interval
        LEFT JOIN item_costs ic ON ic.sale_id = s.id
        LEFT JOIN supply_costs sc ON sc.sale_id = s.id
        GROUP BY p.period_start
      )
      SELECT period_start, income, profit
      FROM period_financials
      ORDER BY period_start
      `
      : Promise.resolve([]);

    const recentSalesRowsPromise = sql`
      SELECT id, sale_number, sold_at, status
      FROM sales
      WHERE org_id = ${orgId}
      ORDER BY sold_at DESC
      LIMIT ${RECENT_SALES}
    `;

    // Todas las series y métricas independientes arrancan juntas. Antes el
    // handler esperaba tres tandas consecutivas de Neon para construir la
    // misma respuesta.
    const [monthlyMetricsRows, weeklyRows, monthlyActivityRows, financialRows, recentSalesRows] = await Promise.all([
      monthlyMetricsPromise,
      weeklyRowsPromise,
      monthlyActivityRowsPromise,
      financialRowsPromise,
      recentSalesRowsPromise,
    ]);
    const metrics = (monthlyMetricsRows as any[])[0];

    // Impacto del partner: crecimiento en actividad (ventas completadas +
    // transacciones) antes vs después de vincularse al portafolio.
    const daysBefore = (new Date(linkedAt).getTime() - new Date(org.created_at).getTime()) / 86_400_000;
    const daysAfter = (Date.now() - new Date(linkedAt).getTime()) / 86_400_000;
    const impact = computeImpact({
      beforeCount: Number(metrics.before_count),
      afterCount: Number(metrics.after_count),
      daysBefore,
      daysAfter,
    });

    const monthlyActivity = (monthlyActivityRows as any[]).map((r) => Number(r.count));
    const activityThisMonth = monthlyActivity[monthlyActivity.length - 1] ?? 0;
    const activityLastMonth = monthlyActivity[monthlyActivity.length - 2] ?? 0;
    const activityTrendPct = activityLastMonth > 0
      ? Number((((activityThisMonth - activityLastMonth) / activityLastMonth) * 100).toFixed(1))
      : null;

    // Estos montos NUNCA salen de este endpoint — `financialPoints` solo se
    // usa acá adentro para derivar el % de variación entre períodos (ver
    // política de ética de datos financieros, documentation/dashboard.md).
    const financialPoints = (financialRows as any[]).map((r) => ({
      period:
        period.unit === "day"
          ? new Date(r.period_start).toISOString().slice(0, 10)
          : new Date(r.period_start).toISOString().slice(0, 7),
      income: Number(r.income),
      profit: Number(r.profit),
    }));

    // Siempre en modo "percent": % de variación vs el período anterior del
    // propio gráfico, nunca el monto. El primer punto no tiene anterior,
    // queda null (nunca se inventa un %).
    const financialChart = {
      mode: "percent" as const,
      granularity: period.unit,
      points: financialPoints.map((p, i) => {
        const prev = financialPoints[i - 1];
        return {
          period: p.period,
          income: prev ? pctChange(p.income, prev.income) : null,
          profit: prev ? pctChange(p.profit, prev.profit) : null,
        };
      }),
    };

    return Response.json({
      data: {
        id: org.id,
        name: org.name,
        logoUrl: org.logo_url,
        // Mes/año que se usó para las stat cards "este mes" de abajo —
        // ver statsPeriod arriba.
        statsPeriod: { year: statsPeriod.year, month: statsPeriod.month },
        availablePeriods,
        createdAt: org.created_at,
        timezone: org.timezone,
        currency: org.currency,
        linkedAt: org.linked_at,
        canViewFinancials: org.share_financials === true,
        ownerName: org.owner_name,
        ownerEmail: org.owner_email,
        industryName: org.industry_name,
        subscriptionStatus: org.subscription_status,
        currentPeriodEnd: org.current_period_end,
        planId: org.plan_id,
        planName: org.plan_name,
        lastActivityAt: org.last_activity_at,
        status,
        monthKpis: {
          grossIncome: org.share_financials === true ? Number(metrics.gross_income) : null,
          netIncome: org.share_financials === true ? Number(metrics.net_income) : null,
          salesCount: Number(metrics.sales_count),
          salesTrendPct: pctChange(
            Number(metrics.sales_count),
            Number(metrics.previous_sales_count),
          ),
          utility: org.share_financials === true ? Number(metrics.utility) : null,
        },
        monthsSponsored: metrics.months_sponsored,
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
        // Gráfico de ingresos/ganancias — SIEMPRE en modo "percent": solo %
        // de variación entre períodos, nunca un monto (ver política de
        // ética de datos financieros).
        financialChart,
        recentSales: (recentSalesRows as any[]).map((s) => ({
          id: s.id,
          saleNumber: s.sale_number,
          soldAt: s.sold_at,
          status: s.status,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/partner/organizations/[id]:", error);
    return createErrorResponse("Error al obtener el emprendedor", 500);
  }
}
