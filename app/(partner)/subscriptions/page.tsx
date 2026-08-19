"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { useDebounce } from "@/hooks/use-debounce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SponsorModal } from "@/components/partner/sponsor-modal";
import { formatDateShort } from "@/lib/utils";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  Wallet1Outlined,
  Search1Outlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
} from "@lineiconshq/free-icons";

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
  // Fuerza un remount (y por lo tanto un refetch desde página 1) del
  // historial de patrocinios cuando se registra uno nuevo — más simple que
  // levantar el estado de búsqueda/página hasta acá solo para invalidar esa
  // key de SWR en particular.
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);

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
          onSuccess={() => {
            mutate();
            setPaymentsRefreshKey((k) => k + 1);
          }}
          orgId={sponsorTarget.id}
          orgName={sponsorTarget.name}
          currentPlanId={sponsorTarget.planId}
        />
      )}

      <PaymentHistorySection key={paymentsRefreshKey} />
    </div>
  );
}

// ── Historial de patrocinios ─────────────────────────────────────────────
// Mismo nivel de detalle que la tabla de Pagos en hikonta-admin (monto,
// meses, período cubierto, método, estado, fecha, comprobante) pero acotado
// a lo que ESTE partner pagó — GET /api/partner/subscriptions/payments.

type PaymentRow = {
  id: number;
  orgId: number;
  orgName: string;
  ownerEmail: string | null;
  amountUsd: number;
  currency: string;
  status: "PAID" | "PENDING" | "FAILED" | "REFUNDED";
  provider: "MANUAL" | "STRIPE" | "PAYPAL" | null;
  monthsPurchased: number;
  coversPeriodStart: string | null;
  coversPeriodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
  receiptUrl: string | null;
};

type PaymentsResponse = {
  data: PaymentRow[];
  total: number;
  page: number;
  pages: number;
  lifetime: { totalUsd: number; totalMonths: number };
};

const PAYMENT_STATUS_LABEL: Record<PaymentRow["status"], string> = {
  PAID: "Pagado",
  PENDING: "Pendiente",
  FAILED: "Fallido",
  REFUNDED: "Reembolsado",
};

const PAYMENT_STATUS_VARIANT: Record<PaymentRow["status"], "success" | "warning" | "muted" | "danger"> = {
  PAID: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "muted",
};

const PROVIDER_LABEL: Record<string, string> = { MANUAL: "Manual", STRIPE: "Stripe", PAYPAL: "PayPal" };

const INPUT_CLASS =
  "rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring";

function PaymentHistorySection() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 350);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);
  const handleStatus = useCallback((v: string) => {
    setStatus(v);
    setPage(1);
  }, []);

  const qs = new URLSearchParams({
    search: debouncedSearch,
    status,
    page: String(page),
  }).toString();

  const { data, isLoading } = usePartnerSWR<PaymentsResponse>(`/api/partner/subscriptions/payments?${qs}`);

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Historial de patrocinios</h2>
          <p className="text-sm text-muted-foreground">
            Meses que patrocinaste vos, con período cubierto, método y comprobante.
          </p>
        </div>
        {data && data.lifetime.totalMonths > 0 && (
          <p className="text-sm text-muted-foreground">
            Total histórico: <span className="font-bold text-foreground">${data.lifetime.totalUsd.toFixed(2)}</span>
            {" · "}
            {data.lifetime.totalMonths} mes{data.lifetime.totalMonths === 1 ? "" : "es"}
          </p>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Lineicons icon={Search1Outlined} size={15} />
          </span>
          <input
            placeholder="Buscar por negocio…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className={`${INPUT_CLASS} w-full pl-10`}
          />
        </div>
        <select
          value={status}
          onChange={(e) => handleStatus(e.target.value)}
          className={`${INPUT_CLASS} sm:w-44`}
        >
          <option value="all">Todos los estados</option>
          <option value="PAID">Pagado</option>
          <option value="PENDING">Pendiente</option>
          <option value="FAILED">Fallido</option>
          <option value="REFUNDED">Reembolsado</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {data && data.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {search || status !== "all"
            ? "Ningún patrocinio coincide con ese filtro."
            : "Todavía no patrocinaste ningún mes — hacelo desde la tabla de arriba."}
        </p>
      )}

      {data && data.data.length > 0 && (
        <div className="card-elevated overflow-x-auto rounded-xl bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold sm:px-5">Negocio</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Monto</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Meses</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Período cubierto</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Método</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Estado</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Fecha</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((p) => (
                <tr key={p.id} className="border-t border-border first:border-0">
                  <td className="px-3 py-3 sm:px-5">
                    <Link href={`/organizations/${p.orgId}`} className="font-bold hover:underline">
                      {p.orgName}
                    </Link>
                    {p.ownerEmail && <p className="text-xs text-muted-foreground">{p.ownerEmail}</p>}
                  </td>
                  {/* amount_usd está siempre en USD (mismo campo que usa
                      lib/billing.ts) — mostrarlo con "$", no con
                      formatCurrency() que formatea en HNL. */}
                  <td className="px-3 py-3 font-semibold sm:px-5">${p.amountUsd.toFixed(2)}</td>
                  <td className="px-3 py-3 sm:px-5">{p.monthsPurchased}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground sm:px-5">
                    {p.coversPeriodStart ? formatDateShort(p.coversPeriodStart) : "—"}
                    {" → "}
                    {p.coversPeriodEnd ? formatDateShort(p.coversPeriodEnd) : "—"}
                  </td>
                  <td className="px-3 py-3 sm:px-5">{PROVIDER_LABEL[p.provider ?? ""] ?? p.provider ?? "—"}</td>
                  <td className="px-3 py-3 sm:px-5">
                    <Badge variant={PAYMENT_STATUS_VARIANT[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground sm:px-5">
                    {formatDateShort(p.paidAt ?? p.createdAt)}
                  </td>
                  <td className="px-3 py-3 sm:px-5">
                    {p.receiptUrl ? (
                      <a
                        href={p.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {data.page} de {data.pages} · {data.total} patrocinio{data.total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Lineicons icon={ArrowLeftOutlined} size={13} />
              Anterior
            </Button>
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              disabled={page >= data.pages}
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            >
              Siguiente
              <Lineicons icon={ArrowRightOutlined} size={13} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
