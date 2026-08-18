import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// GET /api/partner/plans — catálogo de planes activos, para el selector del
// formulario de patrocinio (POST /api/partner/sponsor). `subscription_plans`
// es una tabla de plataforma (sin org_id/tenant), equivalente a lo que ya se
// muestra públicamente en el pricing de HiKonta — no hay dato sensible que
// filtrar acá, así que no requiere más que estar autenticado como partner.
export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const plans = await sql`
      SELECT id, name, price_usd, billing_interval
      FROM subscription_plans
      WHERE is_active = TRUE
      ORDER BY price_usd ASC
    `;

    return Response.json({
      data: (plans as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        priceUsd: Number(p.price_usd),
        billingInterval: p.billing_interval,
      })),
    });
  } catch (error) {
    console.error("GET /api/partner/plans:", error);
    return createErrorResponse("Error al obtener los planes", 500);
  }
}
