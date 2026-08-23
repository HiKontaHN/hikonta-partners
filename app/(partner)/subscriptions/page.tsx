"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { useDebounce } from "@/hooks/use-debounce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/partner/stat-card";
import { SponsorModal } from "@/components/partner/sponsor-modal";
import { SectionSpinner } from "@/components/ui/spinner";
import { formatDateShort } from "@/lib/utils";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  Wallet1Outlined,
  Search1Outlined,
  Ticket1Outlined,
  Crown3Outlined,
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

type SubscriptionsSummary = {
  activeCount: number;
  trialCount: number;
  pastDueCount: number;
  cancelledCount: number;
  expiredCount: number;
  totalCount: number;
};

type ActivelySponsoredOrg = {
  id: number;
  name: string;
  logoUrl: string | null;
  planName: string | null;
  currentPeriodEnd: string | null;
  monthsSponsored: number;
};

type SubscriptionsResponse = {
  data: SubscriptionRow[];
  total: number;
  summary: SubscriptionsSummary;
  activelySponsored: ActivelySponsoredOrg[];
};

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

// Cantidad de filas/cards por página en las secciones que paginamos del
// lado del cliente (Suscripciones, Licencias, Patrocinando) — "Historial"
// ya pagina del lado del servidor con su propio tamaño de página.
const PAGE_SIZE = 8;

function paginate<T>(items: T[], page: number, pageSize: number): { pageItems: T[]; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(Math.max(1, page), pages);
  const start = (clampedPage - 1) * pageSize;
  return { pageItems: items.slice(start, start + pageSize), pages };
}

const TABS: TabItem[] = [
  { key: "subs", label: "Suscripciones" },
  { key: "licenses", label: "Licencias" },
  { key: "sponsored", label: "Patrocinando" },
  { key: "history", label: "Historial" },
];

export default function SubscriptionsPage() {
  const { data, isLoading, mutate } = usePartnerSWR<SubscriptionsResponse>("/api/partner/subscriptions");
  const [sponsorTarget, setSponsorTarget] = useState<SubscriptionRow | null>(null);
  // Fuerza un remount (y por lo tanto un refetch desde página 1) del
  // historial de patrocinios cuando se registra uno nuevo — más simple que
  // levantar el estado de búsqueda/página hasta acá solo para invalidar esa
  // key de SWR en particular.
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<string>(TABS[0].key);

  // Mismas keys que usan LicensesSection/HistorySection más abajo — SWR las
  // deduplica (un solo fetch de red), esto solo lee el resultado compartido
  // para armar las stat cards de arriba. `mutateCredits` revalida esa key
  // compartida (afecta también a LicensesSection) cuando un patrocinio
  // consume una licencia.
  const { data: creditsData, mutate: mutateCredits } = usePartnerSWR<CreditsResponse>("/api/partner/credits");
  const { data: paymentsData } = usePartnerSWR<PaymentsResponse>(
    "/api/partner/subscriptions/payments?search=&status=all&page=1"
  );

  const summary = data?.summary;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 pt-4 sm:pt-5">
        <div>
          <h1 className="text-xl font-semibold">Suscripciones</h1>
          <p className="text-sm text-muted-foreground">
            Plan y vencimiento de cada emprendedor de tu portafolio — puedes patrocinar meses de
            plan directamente desde acá.
          </p>
        </div>
      </div>

      {/* grid-cols-2 en mobile (no grid-cols-1): "Suscripciones activas" e
          "Historial de patrocinios" van lado a lado en una fila para no
          ocupar tanto alto — pedido explícito. "Licencias sin asignar"
          ocupa la fila completa debajo (col-span-2) en vez de quedar sola
          a la mitad. */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          title="Suscripciones activas"
          value={summary ? summary.activeCount : "—"}
          subtitle={summary ? `de ${summary.totalCount} en tu portafolio` : undefined}
          icon={Crown3Outlined}
        />
        <StatCard
          title="Historial de patrocinios"
          value={paymentsData ? `${paymentsData.lifetime.totalMonths} meses` : "—"}
          subtitle={paymentsData ? `$${paymentsData.lifetime.totalUsd.toFixed(2)} pagados en total` : undefined}
          icon={Wallet1Outlined}
        />
        <div className="col-span-2 sm:col-span-1">
          <StatCard
            title="Licencias sin asignar"
            value={creditsData ? creditsData.totals.pending : "—"}
            subtitle={creditsData ? `${creditsData.totals.claimed} ya asignadas` : undefined}
            icon={Ticket1Outlined}
          />
        </div>
      </div>

      {/* Tabs en vez de apilar las 4 secciones una debajo de otra — pedido
          explícito para no hacer tanto scroll, ver feedback de diseño
          2026-08-23. Solo se monta la sección activa. */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "subs" && (
        <SubscriptionsSection rows={data?.data ?? []} isLoading={isLoading} onSponsor={setSponsorTarget} />
      )}
      {activeTab === "licenses" && <LicensesSection />}
      {activeTab === "sponsored" && (
        <SponsoredSection orgs={data?.activelySponsored ?? []} isLoading={isLoading} />
      )}
      {activeTab === "history" && <HistorySection key={paymentsRefreshKey} />}

      {sponsorTarget && (
        <SponsorModal
          key={sponsorTarget.id}
          open
          onClose={() => setSponsorTarget(null)}
          onSuccess={() => {
            mutate();
            mutateCredits();
            setPaymentsRefreshKey((k) => k + 1);
          }}
          orgId={sponsorTarget.id}
          orgName={sponsorTarget.name}
        />
      )}
    </div>
  );
}

// Texto + color de la fecha de vencimiento — compartido entre la tabla
// (desktop) y las cards (mobile) de la pestaña "Suscripciones".
function RenewalDate({ periodEnd, daysUntilRenewal }: { periodEnd: string | null; daysUntilRenewal: number | null }) {
  if (!periodEnd) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={
        daysUntilRenewal !== null && daysUntilRenewal < 0
          ? "font-semibold text-destructive"
          : daysUntilRenewal !== null && daysUntilRenewal <= 7
            ? "font-semibold text-muted-foreground"
            : ""
      }
    >
      {formatDateShort(periodEnd)}
      {daysUntilRenewal !== null && (
        <span className="ml-1 text-xs text-muted-foreground">
          ({daysUntilRenewal < 0 ? "vencido" : `${daysUntilRenewal}d`})
        </span>
      )}
    </span>
  );
}

// ── Suscripciones (pestaña principal) ─────────────────────────────────────
// Sin paginación del lado del servidor (el endpoint trae todo el
// portafolio) — se pagina acá mismo, en el cliente, tanto para la tabla
// como para las cards de mobile (comparten la misma página de datos).

function SubscriptionsSection({
  rows,
  isLoading,
  onSponsor,
}: {
  rows: SubscriptionRow[];
  isLoading: boolean;
  onSponsor: (sub: SubscriptionRow) => void;
}) {
  const [page, setPage] = useState(1);

  if (isLoading) return <SectionSpinner />;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay emprendedores vinculados a tu portafolio.
      </p>
    );
  }

  const { pageItems, pages } = paginate(rows, page, PAGE_SIZE);

  return (
    <div>
      {/* Tabla — desktop/tablet */}
      <div className="card-elevated hidden overflow-x-auto rounded-xl bg-card sm:block">
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
            {pageItems.map((sub) => (
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
                  <RenewalDate periodEnd={sub.currentPeriodEnd} daysUntilRenewal={sub.daysUntilRenewal} />
                </td>
                <td className="px-3 py-3 text-muted-foreground sm:px-5">
                  {sub.monthsSponsored > 0 ? `${sub.monthsSponsored} mes${sub.monthsSponsored === 1 ? "" : "es"}` : "—"}
                </td>
                <td className="px-3 py-3 text-right sm:px-5">
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => onSponsor(sub)}>
                    <Lineicons icon={Wallet1Outlined} size={13} />
                    Patrocinar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="flex flex-col gap-3 sm:hidden">
        {pageItems.map((sub) => (
          <div key={sub.id} className="card-elevated flex flex-col gap-3 rounded-xl bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/organizations/${sub.id}`} className="block truncate font-bold hover:underline">
                  {sub.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {sub.ownerName ?? sub.ownerEmail ?? "Sin propietario"}
                </p>
              </div>
              {sub.subscriptionStatus ? (
                <Badge variant={STATUS_VARIANT[sub.subscriptionStatus]} className="shrink-0">
                  {STATUS_LABEL[sub.subscriptionStatus]}
                </Badge>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">—</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <p className="text-muted-foreground">Plan</p>
                <p className="font-semibold">{sub.planName ?? "Sin plan"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vence</p>
                <RenewalDate periodEnd={sub.currentPeriodEnd} daysUntilRenewal={sub.daysUntilRenewal} />
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Patrocinados por ti</p>
                <p>{sub.monthsSponsored > 0 ? `${sub.monthsSponsored} mes${sub.monthsSponsored === 1 ? "" : "es"}` : "—"}</p>
              </div>
            </div>
            <Button variant="secondary" className="w-full justify-center text-xs" onClick={() => onSponsor(sub)}>
              <Lineicons icon={Wallet1Outlined} size={13} />
              Patrocinar
            </Button>
          </div>
        ))}
      </div>

      <Pagination page={Math.min(page, pages)} pages={pages} total={rows.length} itemLabel="negocio" onChange={setPage} />
    </div>
  );
}

// ── Licencias de suscripción (antes "Créditos") ───────────────────────────
// Lotes que HiKonta te facturó por adelantado (N suscripciones de M meses,
// sin organización asignada todavía) — ver GET /api/partner/credits. Es de
// SOLO LECTURA a propósito: el lote lo arma un admin de HiKonta desde su
// panel, no vos. Repartir cada licencia por link o email a un emprendedor
// nuevo es un paso que todavía no existe — cuando esté construido, esta
// misma sección es donde va a vivir esa acción.

type CreditBatchRow = {
  id: number;
  plan_name: string;
  months: number;
  quantity: number;
  list_unit_price_usd: number;
  unit_price_usd: number;
  total_usd: number;
  currency: string;
  created_at: string;
  pending_count: number;
  claimed_count: number;
  revoked_count: number;
};

type CreditsResponse = {
  data: CreditBatchRow[];
  totals: { pending: number; claimed: number };
};

function LicensesSection() {
  const { data, isLoading } = usePartnerSWR<CreditsResponse>("/api/partner/credits");
  const [page, setPage] = useState(1);

  if (isLoading) return <SectionSpinner />;

  if (!data || data.data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no tenés licencias de suscripción compradas por adelantado.
      </p>
    );
  }

  const { pageItems, pages } = paginate(data.data, page, PAGE_SIZE);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Lotes que HiKonta te facturó por adelantado — todavía sin repartir a ningún negocio.
        </p>
        {data.totals.pending > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{data.totals.pending}</span> pendiente
            {data.totals.pending === 1 ? "" : "s"} de asignar
          </p>
        )}
      </div>

      <div className="card-elevated hidden overflow-x-auto rounded-xl bg-card sm:block">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-semibold sm:px-5">Plan</th>
              <th className="px-3 py-3 font-semibold sm:px-5">Duración</th>
              <th className="px-3 py-3 font-semibold sm:px-5">Cantidad</th>
              <th className="px-3 py-3 font-semibold sm:px-5">Total pagado</th>
              <th className="px-3 py-3 font-semibold sm:px-5">Licencias</th>
              <th className="px-3 py-3 font-semibold sm:px-5">Comprado</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((b) => (
              <tr key={b.id} className="border-t border-border first:border-0">
                <td className="px-3 py-3 font-bold sm:px-5">
                  <Lineicons icon={Ticket1Outlined} size={14} className="mr-1.5 inline text-muted-foreground" />
                  {b.plan_name}
                </td>
                <td className="px-3 py-3 sm:px-5">
                  {b.months} mes{b.months === 1 ? "" : "es"}
                </td>
                <td className="px-3 py-3 sm:px-5">{b.quantity}</td>
                <td className="px-3 py-3 font-semibold sm:px-5">${b.total_usd.toFixed(2)}</td>
                <td className="px-3 py-3 sm:px-5">
                  <span className="text-muted-foreground">
                    {b.pending_count} pendiente{b.pending_count === 1 ? "" : "s"}
                  </span>
                  {b.claimed_count > 0 && (
                    <span className="ml-1.5 text-chip-green">· {b.claimed_count} asignado{b.claimed_count === 1 ? "" : "s"}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-muted-foreground sm:px-5">{formatDateShort(b.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {pageItems.map((b) => (
          <div key={b.id} className="card-elevated flex flex-col gap-3 rounded-xl bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-bold">
                <Lineicons icon={Ticket1Outlined} size={14} className="text-muted-foreground" />
                {b.plan_name}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateShort(b.created_at)}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <p className="text-muted-foreground">Duración</p>
                <p className="font-semibold">{b.months} mes{b.months === 1 ? "" : "es"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cantidad</p>
                <p className="font-semibold">{b.quantity}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total pagado</p>
                <p className="font-semibold">${b.total_usd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Licencias</p>
                <p>
                  <span className="text-muted-foreground">{b.pending_count} pendiente{b.pending_count === 1 ? "" : "s"}</span>
                  {b.claimed_count > 0 && (
                    <span className="ml-1 text-chip-green">· {b.claimed_count} asignado{b.claimed_count === 1 ? "" : "s"}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={Math.min(page, pages)} pages={pages} total={data.data.length} itemLabel="lote" onChange={setPage} />
    </div>
  );
}

// ── Patrocinando activamente ───────────────────────────────────────────────
// Distinto del historial: acá solo orgs con suscripción ACTIVE hoy que vos
// patrocinaste alguna vez (ver activelySponsored en GET
// /api/partner/subscriptions) — si una org canceló, sale de esta lista
// aunque siga en el historial de pagos.

function SponsoredSection({ orgs, isLoading }: { orgs: ActivelySponsoredOrg[]; isLoading: boolean }) {
  const [page, setPage] = useState(1);

  if (isLoading) return <SectionSpinner />;

  if (orgs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no estás patrocinando ningún emprendedor activamente.
      </p>
    );
  }

  const { pageItems, pages } = paginate(orgs, page, PAGE_SIZE);

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Suscripción activa hoy, con al menos un mes pagado por vos.
      </p>

      <div className="card-elevated hidden overflow-x-auto rounded-xl bg-card sm:block">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-semibold sm:px-5">Negocio</th>
              <th className="px-3 py-3 font-semibold sm:px-5">Plan</th>
              <th className="px-3 py-3 font-semibold sm:px-5">Meses patrocinados</th>
              <th className="px-3 py-3 font-semibold sm:px-5">Vence</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((o) => (
              <tr key={o.id} className="border-t border-border first:border-0">
                <td className="px-3 py-3 sm:px-5">
                  <Link href={`/organizations/${o.id}`} className="font-bold hover:underline">
                    {o.name}
                  </Link>
                </td>
                <td className="px-3 py-3 text-muted-foreground sm:px-5">{o.planName ?? "—"}</td>
                <td className="px-3 py-3 sm:px-5">
                  {o.monthsSponsored} mes{o.monthsSponsored === 1 ? "" : "es"}
                </td>
                <td className="px-3 py-3 text-muted-foreground sm:px-5">
                  {o.currentPeriodEnd ? formatDateShort(o.currentPeriodEnd) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {pageItems.map((o) => (
          <div key={o.id} className="card-elevated flex flex-col gap-3 rounded-xl bg-card p-4">
            <Link href={`/organizations/${o.id}`} className="truncate font-bold hover:underline">
              {o.name}
            </Link>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <p className="text-muted-foreground">Plan</p>
                <p>{o.planName ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Meses patrocinados</p>
                <p>{o.monthsSponsored} mes{o.monthsSponsored === 1 ? "" : "es"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Vence</p>
                <p>{o.currentPeriodEnd ? formatDateShort(o.currentPeriodEnd) : "—"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={Math.min(page, pages)} pages={pages} total={orgs.length} itemLabel="negocio" onChange={setPage} />
    </div>
  );
}

// ── Historial de patrocinios ─────────────────────────────────────────────
// Mismo nivel de detalle que la tabla de Pagos en hikonta-admin (monto,
// meses, período cubierto, método, estado, fecha, comprobante) pero acotado
// a lo que ESTE partner pagó — GET /api/partner/subscriptions/payments. Ya
// pagina del lado del servidor (search + status + page), a diferencia de
// las otras tres secciones de esta página.

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

function HistorySection() {
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
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Meses que patrocinaste vos, con período cubierto, método y comprobante.
        </p>
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
        <Select
          value={status}
          onChange={handleStatus}
          className="sm:w-44"
          options={[
            { value: "all", label: "Todos los estados" },
            ...Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>

      {isLoading && <SectionSpinner />}

      {data && data.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {search || status !== "all"
            ? "Ningún patrocinio coincide con ese filtro."
            : "Todavía no patrocinaste ningún mes — hacelo desde la pestaña Suscripciones."}
        </p>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="card-elevated hidden overflow-x-auto rounded-xl bg-card sm:block">
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

          <div className="flex flex-col gap-3 sm:hidden">
            {data.data.map((p) => (
              <div key={p.id} className="card-elevated flex flex-col gap-3 rounded-xl bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/organizations/${p.orgId}`} className="block truncate font-bold hover:underline">
                      {p.orgName}
                    </Link>
                    {p.ownerEmail && <p className="truncate text-xs text-muted-foreground">{p.ownerEmail}</p>}
                  </div>
                  <Badge variant={PAYMENT_STATUS_VARIANT[p.status]} className="shrink-0">
                    {PAYMENT_STATUS_LABEL[p.status]}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Monto</p>
                    <p className="font-semibold">${p.amountUsd.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Meses</p>
                    <p>{p.monthsPurchased}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Período cubierto</p>
                    <p>
                      {p.coversPeriodStart ? formatDateShort(p.coversPeriodStart) : "—"}
                      {" → "}
                      {p.coversPeriodEnd ? formatDateShort(p.coversPeriodEnd) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Método</p>
                    <p>{PROVIDER_LABEL[p.provider ?? ""] ?? p.provider ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fecha</p>
                    <p>{formatDateShort(p.paidAt ?? p.createdAt)}</p>
                  </div>
                </div>
                {p.receiptUrl && (
                  <a
                    href={p.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Ver comprobante
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} itemLabel="patrocinio" onChange={setPage} />
      )}
    </div>
  );
}
