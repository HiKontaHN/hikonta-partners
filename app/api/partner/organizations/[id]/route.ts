import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess, requireOwnedOrganization } from "@/lib/auth";
import { sql } from "@/lib/db";

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
        os.status AS subscription_status, os.current_period_end,
        sp.name   AS plan_name
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      LEFT JOIN org_subscriptions os ON os.org_id = o.id
      LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
      WHERE o.id = ${orgId}
    `;

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

    return Response.json({
      data: {
        ...org,
        counts,
        monthsSponsored: sponsorship.months_sponsored,
        // Montos financieros: solo si share_financials = TRUE (ver arquitectura)
      },
    });
  } catch (error) {
    console.error("GET /api/partner/organizations/[id]:", error);
    return createErrorResponse("Error al obtener la organización", 500);
  }
}
