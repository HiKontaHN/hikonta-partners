"use client";

import { useState } from "react";
import Link from "next/link";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SponsorModal } from "@/components/partner/sponsor-modal";
import { formatDateShort } from "@/lib/utils";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { Wallet1Outlined } from "@lineiconshq/free-icons";

type SubscriptionRow = {
  id: number;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  planId: number | null;
  planName: string | null;
  planPriceUsd: number | null;
  planBillingInterval: string | null;
  subscriptionStatus: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  daysUntilRenewal: number | null;
  monthsSponsored: number;
};

type SubscriptionsResponse = { data: SubscriptionRow[]; total: number };

const STATUS_LABEL: Record<string, string> = {
  TRIAL: "Prueba",
  ACTIVE: "Activa",
  PAST_DUE: "Pago vencido",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "muted" | "danger"> = {
  TRIAL: "muted",
  ACTIVE: "success",
  PAST_DUE: "danger",
  CANCELLED: "muted",
  EXPIRED: "danger",
};

export default function SubscriptionsPage() {
  const { data, isLoading, mutate } = usePartnerSWR<SubscriptionsResponse>("/api/partner/subscriptions");
  const [sponsorTarget, setSponsorTarget] = useState<SubscriptionRow | null>(null);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Suscripciones</h1>
          <p className="text-sm text-muted-foreground">
            Plan y vencimiento de cada emprendedor de tu portafolio — puedes patrocinar meses de
            plan directamente desde acá.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {data && data.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay organizaciones vinculadas a tu portafolio.
        </p>
      )}

      {data && data.data.length > 0 && (
        <div className="card-elevated overflow-x-auto rounded-xl bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold sm:px-5">Negocio</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Propietario</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Plan</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Estado</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Vence</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Patrocinados por ti</th>
                <th className="px-3 py-3 font-semibold sm:px-5" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((sub) => (
                <tr key={sub.id} className="border-t border-border first:border-0">
                  <td className="px-3 py-3 font-bold sm:px-5">
                    <Link href={`/organizations/${sub.id}`} className="hover:underline">
                      {sub.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground sm:px-5">
                    {sub.ownerName ?? sub.ownerEmail ?? "—"}
                  </td>
                  <td className="px-3 py-3 sm:px-5">{sub.planName ?? "Sin plan"}</td>
                  <td className="px-3 py-3 sm:px-5">
                    {sub.subscriptionStatus ? (
                      <Badge variant={STATUS_VARIANT[sub.subscriptionStatus]}>
                        {STATUS_LABEL[sub.subscriptionStatus]}
                        {sub.cancelAtPeriodEnd && sub.subscriptionStatus === "ACTIVE" ? " (no renueva)" : ""}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 sm:px-5">
                    {sub.currentPeriodEnd ? (
                      <span
                        className={
                          sub.daysUntilRenewal !== null && sub.daysUntilRenewal < 0
                            ? "font-semibold text-destructive"
                            : sub.daysUntilRenewal !== null && sub.daysUntilRenewal <= 7
                              ? "font-semibold text-chip-amber"
                              : ""
                        }
                      >
                        {formatDateShort(sub.currentPeriodEnd)}
                        {sub.daysUntilRenewal !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({sub.daysUntilRenewal < 0 ? "vencido" : `${sub.daysUntilRenewal}d`})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground sm:px-5">
                    {sub.monthsSponsored > 0 ? `${sub.monthsSponsored} mes${sub.monthsSponsored === 1 ? "" : "es"}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-right sm:px-5">
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setSponsorTarget(sub)}
                    >
                      <Lineicons icon={Wallet1Outlined} size={13} />
                      Patrocinar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sponsorTarget && (
        <SponsorModal
          key={sponsorTarget.id}
          open
          onClose={() => setSponsorTarget(null)}
          onSuccess={() => mutate()}
          orgId={sponsorTarget.id}
          orgName={sponsorTarget.name}
          currentPlanId={sponsorTarget.planId}
        />
      )}
    </div>
  );
}
