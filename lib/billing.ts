// lib/billing.ts
import { sql } from "@/lib/db";

// ── applySubscriptionPayment ────────────────────────────────────────
// Registra un pago (o patrocinio de partner) y extiende
// org_subscriptions.current_period_end. Si el período actual no ha
// vencido, acumula los meses; si ya venció, arranca desde hoy.
//
// Mismo mecanismo tanto para un pago normal (paidByPartnerId = null)
// como para un patrocinio de incubadora (paidByPartnerId = partner.id).
// Ver database/docs/partner-dashboard-architecture.md en yelifin-sistema.

export async function applySubscriptionPayment(
  orgId: number,
  monthsPurchased: number,
  opts: {
    amountUsd: number;
    planId?: number;
    providerPaymentId?: string;
    paidByPartnerId?: number;
  }
) {
  if (monthsPurchased <= 0) {
    throw new Error("monthsPurchased debe ser mayor a 0");
  }

  const [org] = await sql`
    SELECT os.id AS org_subscription_id, os.current_period_end, os.plan_id
    FROM org_subscriptions os
    WHERE os.org_id = ${orgId}
  `;
  if (!org) throw new Error(`La organización ${orgId} no tiene org_subscriptions`);

  const now = new Date();
  const base =
    org.current_period_end && new Date(org.current_period_end) > now
      ? new Date(org.current_period_end) // aún activo → se acumula
      : now; // vencido → arranca desde hoy

  const periodStart = base;
  const periodEnd = new Date(base);
  periodEnd.setMonth(periodEnd.getMonth() + monthsPurchased);

  await sql`
    UPDATE org_subscriptions
    SET status = 'ACTIVE',
        current_period_start = ${periodStart.toISOString()},
        current_period_end   = ${periodEnd.toISOString()},
        plan_id = COALESCE(${opts.planId ?? null}, plan_id),
        updated_at = NOW()
    WHERE org_id = ${orgId}
  `;

  const [payment] = await sql`
    INSERT INTO subscription_payments
      (org_id, org_subscription_id, amount_usd, months_purchased,
       covers_period_start, covers_period_end, status,
       provider, provider_payment_id, paid_by_partner_id, paid_at)
    VALUES
      (${orgId}, ${org.org_subscription_id}, ${opts.amountUsd}, ${monthsPurchased},
       ${periodStart.toISOString()}, ${periodEnd.toISOString()}, 'PAID',
       'MANUAL', ${opts.providerPaymentId ?? null}, ${opts.paidByPartnerId ?? null}, NOW())
    RETURNING id
  `;

  return { paymentId: payment.id, periodStart, periodEnd };
}
