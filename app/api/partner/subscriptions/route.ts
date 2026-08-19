import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// GET /api/partner/subscriptions — estado de suscripción de cada org del
// portafolio, para el panel donde el partner administra/patrocina planes
// (POST /api/partner/sponsor hace la escritura, esta ruta es solo lectura).
// No requiere share_financials: el estado/vencimiento del plan no es un
// monto de ventas del emprendedor, es la relación comercial con HiKonta.
export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = 10; // paginación estándar de HiKonta
    const offset = (page - 1) * limit;

    const rows = await sql`
      SELECT
        o.id, o.name, o.logo_url,
        u.display_name AS owner_name,
        u.email        AS owner_email,
        os.plan_id,
        sp.name             AS plan_name,
        sp.price_usd        AS plan_price_usd,
        sp.billing_interval AS plan_billing_interval,
        os.status               AS subscription_status,
        os.current_period_end,
        os.cancel_at_period_end,
        os.trial_end_date,
        (SELECT COALESCE(SUM(months_purchased), 0)::int
           FROM subscription_payments
           WHERE org_id = o.id AND paid_by_partner_id = ${auth.data.partnerId}) AS months_sponsored
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      LEFT JOIN users u ON u.id = o.owner_user_id
      LEFT JOIN org_subscriptions os ON os.org_id = o.id
      LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
      ORDER BY os.current_period_end ASC NULLS LAST, o.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ total }] = await sql`
      SELECT COUNT(*)::int AS total FROM partner_organizations WHERE partner_id = ${auth.data.partnerId}
    `;

    // Resumen por estado — TODO el portafolio, no solo esta página (10 a la
    // vez) — para las stat cards del panel.
    const [summaryRow] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE os.status = 'ACTIVE')    AS active_count,
        COUNT(*) FILTER (WHERE os.status = 'TRIAL')     AS trial_count,
        COUNT(*) FILTER (WHERE os.status = 'PAST_DUE')  AS past_due_count,
        COUNT(*) FILTER (WHERE os.status = 'CANCELLED') AS cancelled_count,
        COUNT(*) FILTER (WHERE os.status = 'EXPIRED')   AS expired_count
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      LEFT JOIN org_subscriptions os ON os.org_id = o.id
    `;

    // Orgs que ESTE partner patrocinó y cuya suscripción sigue activa hoy —
    // distinto del historial completo de pagos (que puede incluir orgs que
    // ya cancelaron). Sin paginar: son un subconjunto chico del portafolio.
    const activelySponsoredRows = await sql`
      SELECT
        o.id, o.name, o.logo_url,
        sp.name AS plan_name,
        os.current_period_end,
        (SELECT COALESCE(SUM(months_purchased), 0)::int
           FROM subscription_payments
           WHERE org_id = o.id AND paid_by_partner_id = ${auth.data.partnerId}) AS months_sponsored
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      LEFT JOIN org_subscriptions os ON os.org_id = o.id
      LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
      WHERE os.status = 'ACTIVE'
        AND EXISTS (
          SELECT 1 FROM subscription_payments
          WHERE org_id = o.id AND paid_by_partner_id = ${auth.data.partnerId} AND months_purchased > 0
        )
      ORDER BY os.current_period_end ASC NULLS LAST
    `;

    const now = Date.now();

    const data = (rows as any[]).map((o) => {
      const daysUntilRenewal = o.current_period_end
        ? Math.ceil((new Date(o.current_period_end).getTime() - now) / 86_400_000)
        : null;

      return {
        id: o.id,
        name: o.name,
        logoUrl: o.logo_url,
        ownerName: o.owner_name,
        ownerEmail: o.owner_email,
        planId: o.plan_id,
        planName: o.plan_name,
        planPriceUsd: o.plan_price_usd !== null ? Number(o.plan_price_usd) : null,
        planBillingInterval: o.plan_billing_interval,
        subscriptionStatus: o.subscription_status,
        currentPeriodEnd: o.current_period_end,
        cancelAtPeriodEnd: o.cancel_at_period_end,
        trialEndDate: o.trial_end_date,
        daysUntilRenewal,
        monthsSponsored: o.months_sponsored,
      };
    });

    return Response.json({
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
      summary: {
        activeCount: Number(summaryRow.active_count),
        trialCount: Number(summaryRow.trial_count),
        pastDueCount: Number(summaryRow.past_due_count),
        cancelledCount: Number(summaryRow.cancelled_count),
        expiredCount: Number(summaryRow.expired_count),
        totalCount: total,
      },
      activelySponsored: (activelySponsoredRows as any[]).map((o) => ({
        id: o.id,
        name: o.name,
        logoUrl: o.logo_url,
        planName: o.plan_name,
        currentPeriodEnd: o.current_period_end,
        monthsSponsored: o.months_sponsored,
      })),
    });
  } catch (error) {
    console.error("GET /api/partner/subscriptions:", error);
    return createErrorResponse("Error al obtener las suscripciones", 500);
  }
}
