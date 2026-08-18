import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess, requireOwnedOrganization } from "@/lib/auth";
import { sql } from "@/lib/db";

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
        os.plan_id, os.status AS subscription_status, os.current_period_end,
        sp.name   AS plan_name,
        GREATEST(
          COALESCE((SELECT MAX(sold_at)     FROM sales        WHERE org_id = o.id), o.created_at),
          COALESCE((SELECT MAX(occurred_at) FROM transactions WHERE org_id = o.id), o.created_at)
        ) AS last_activity_at
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      LEFT JOIN users u ON u.id = o.owner_user_id
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

    // Histórico de ingresos (12 meses) — SOLO si la org autorizó compartir
    // montos (share_financials), mismo gate que el resto del panel.
    const shareFinancials = org.share_financials === true;
    const monthlyIncomeRows = shareFinancials
      ? await sql`
          WITH months AS (
            SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
            FROM generate_series(${MONTHS - 1}, 0, -1) AS n
          )
          SELECT m.month_start, COALESCE(SUM(s.total), 0) AS income
          FROM months m
          LEFT JOIN sales s ON s.org_id = ${orgId}
            AND s.sold_at >= m.month_start AND s.sold_at < m.month_start + INTERVAL '1 month'
          GROUP BY m.month_start
          ORDER BY m.month_start
        `
      : [];

    const recentSalesRows = await sql`
      SELECT id, sale_number, sold_at, total, status
      FROM sales
      WHERE org_id = ${orgId}
      ORDER BY sold_at DESC
      LIMIT ${RECENT_SALES}
    `;

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
        // Montos financieros: solo si share_financials = TRUE (ver arquitectura)
        monthlyIncome: (monthlyIncomeRows as any[]).map((r) => ({
          month: new Date(r.month_start).toISOString().slice(0, 7),
          income: Number(r.income),
        })),
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
