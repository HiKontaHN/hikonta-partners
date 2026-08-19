import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess, requireOwnedOrganization } from "@/lib/auth";
import { applySubscriptionPayment } from "@/lib/billing";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

// POST /api/partner/sponsor — el partner patrocina N meses del plan
// de una org de su portafolio. Mismo mecanismo que un pago normal
// (subscription_payments), solo que paidByPartnerId queda seteado.
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
    const { orgId, monthsPurchased, amountUsd = 0, planId } = await request.json();

    if (!Number.isFinite(orgId)) return createErrorResponse("orgId inválido", 400);
    if (!Number.isFinite(monthsPurchased) || monthsPurchased <= 0) {
      return createErrorResponse("monthsPurchased debe ser un entero mayor a 0", 400);
    }

    const deny = await requireOwnedOrganization(auth.data.partnerId, orgId);
    if (deny) return deny;

    const result = await applySubscriptionPayment(orgId, monthsPurchased, {
      amountUsd,
      planId,
      paidByPartnerId: auth.data.partnerId,
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/partner/sponsor:", error);
    return createErrorResponse("Error al registrar el patrocinio", 500);
  }
}
