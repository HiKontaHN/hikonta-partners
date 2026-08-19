import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// GET /api/partner/subscriptions/payments — historial de patrocinios que
// ESTE partner efectivamente pagó (subscription_payments.paid_by_partner_id
// = partnerId), no todos los pagos de sus orgs (esos pueden incluir pagos
// que la propia organización hizo con su tarjeta, que no son asunto del
// partner). Mismo nivel de detalle que GET /api/admin/payments en
// hikonta-admin — monto, meses, período cubierto, método, estado, fecha —
// pero acotado al propio patrocinio, sin el registro manual (eso ya lo hace
// POST /api/partner/sponsor).
export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "all";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = 10;
    const offset = (page - 1) * limit;

    const payments = await sql`
      SELECT
        sp.id, sp.org_id, sp.amount_usd, sp.currency, sp.status, sp.provider,
        sp.months_purchased, sp.covers_period_start, sp.covers_period_end,
        sp.paid_at, sp.created_at, sp.receipt_url,
        o.name  AS org_name,
        o.logo_url,
        u.email AS owner_email
      FROM subscription_payments sp
      JOIN organizations o ON o.id = sp.org_id
      LEFT JOIN users u ON u.id = o.owner_user_id
      WHERE sp.paid_by_partner_id = ${auth.data.partnerId}
        AND (${search} = '' OR o.name ILIKE ${'%' + search + '%'})
        AND (${status} = 'all' OR sp.status = ${status})
      ORDER BY sp.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ total }] = await sql`
      SELECT COUNT(*)::int AS total
      FROM subscription_payments sp
      JOIN organizations o ON o.id = sp.org_id
      WHERE sp.paid_by_partner_id = ${auth.data.partnerId}
        AND (${search} = '' OR o.name ILIKE ${'%' + search + '%'})
        AND (${status} = 'all' OR sp.status = ${status})
    `;

    // Total histórico patrocinado (todas las páginas, no solo esta) — para
    // el resumen arriba de la tabla, mismo espíritu que "N pagos registrados"
    // en hikonta-admin.
    const [{ lifetime_total, lifetime_months }] = await sql`
      SELECT
        COALESCE(SUM(amount_usd), 0)      AS lifetime_total,
        COALESCE(SUM(months_purchased), 0)::int AS lifetime_months
      FROM subscription_payments
      WHERE paid_by_partner_id = ${auth.data.partnerId} AND status = 'PAID'
    `;

    const data = (payments as any[]).map((p) => ({
      id: p.id,
      orgId: p.org_id,
      orgName: p.org_name,
      logoUrl: p.logo_url,
      ownerEmail: p.owner_email,
      amountUsd: Number(p.amount_usd),
      currency: p.currency,
      status: p.status,
      provider: p.provider,
      monthsPurchased: p.months_purchased,
      coversPeriodStart: p.covers_period_start,
      coversPeriodEnd: p.covers_period_end,
      paidAt: p.paid_at,
      createdAt: p.created_at,
      receiptUrl: p.receipt_url,
    }));

    return Response.json({
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
      lifetime: {
        totalUsd: Number(lifetime_total),
        totalMonths: lifetime_months,
      },
    });
  } catch (error) {
    console.error("GET /api/partner/subscriptions/payments:", error);
    return createErrorResponse("Error al obtener el historial de patrocinios", 500);
  }
}
