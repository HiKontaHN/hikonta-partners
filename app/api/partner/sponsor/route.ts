import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess, requireOwnedOrganization } from "@/lib/auth";
import { applySubscriptionPayment } from "@/lib/billing";
import { sql } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

// POST /api/partner/sponsor — el partner patrocina una org de su portafolio
// usando UNO de sus créditos de suscripción ya comprados (lote facturado
// por HiKonta desde hikonta-admin, ver GET /api/partner/credits y
// hikonta-admin/documentation/feature-sponsorship-invites.md). Ya NO acepta
// meses/monto/plan libres — eso dejaba "inventar" un patrocinio sin ningún
// cargo real detrás; ahora todo patrocinio tiene que salir de un lote ya
// pago.
export async function POST(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  // Rate limit propio, igual que register-payment en hikonta-admin — esta
  // ruta escribe pagos/suscripciones reales (subscription_payments), así
  // que amerita un límite más estricto que el global de proxy.ts (300/min),
  // aunque ya esté autenticada.
  const { allowed, retryAfterSec } = rateLimit(
    `sponsor:${getClientIP(request)}`,
    30,
    15 * 60 * 1000,
  );
  if (!allowed) {
    return Response.json(
      { error: "Demasiadas solicitudes. Intentá de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  try {
    const { orgId, batchId } = await request.json();

    if (!Number.isFinite(orgId)) return createErrorResponse("orgId inválido", 400);
    if (!Number.isFinite(batchId)) return createErrorResponse("batchId inválido", 400);

    const deny = await requireOwnedOrganization(auth.data.partnerId, orgId);
    if (deny) return deny;

    // Reclama UN crédito PENDING del lote — UPDATE atómico con subquery: no
    // hace falta un SELECT previo ni una transacción explícita, dos
    // requests concurrentes por el mismo lote no pueden reclamar la misma
    // fila (Postgres relee la subquery bajo el lock de fila del UPDATE).
    const [credit] = await sql`
      UPDATE partner_subscription_credits
      SET status = 'CLAIMED', claimed_org_id = ${orgId}, claimed_at = NOW()
      WHERE id = (
        SELECT id FROM partner_subscription_credits
        WHERE batch_id = ${batchId} AND partner_id = ${auth.data.partnerId} AND status = 'PENDING'
        ORDER BY id ASC
        LIMIT 1
      )
      RETURNING id, plan_id, months
    `;

    if (!credit) {
      return createErrorResponse("No quedan créditos pendientes en ese lote", 409);
    }

    try {
      const result = await applySubscriptionPayment(orgId, credit.months, {
        amountUsd: 0, // ya se cobró al comprar el lote — nunca un cargo nuevo acá
        planId: credit.plan_id,
        paidByPartnerId: auth.data.partnerId,
        providerPaymentId: `credit:${credit.id}`,
      });

      return Response.json({ data: result }, { status: 201 });
    } catch (err) {
      // Compensar: si no se pudo aplicar el pago (ej. la org no tiene
      // org_subscriptions todavía), el crédito vuelve a PENDING — mismo
      // criterio de rollback manual que POST /api/partner/register.
      await sql`
        UPDATE partner_subscription_credits
        SET status = 'PENDING', claimed_org_id = NULL, claimed_at = NULL
        WHERE id = ${credit.id}
      `;
      throw err;
    }
  } catch (error) {
    console.error("POST /api/partner/sponsor:", error);
    return createErrorResponse("Error al registrar el patrocinio", 500);
  }
}
