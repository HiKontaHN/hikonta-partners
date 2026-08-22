"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { usePageHeader } from "@/components/partner/page-header-slot";
import { PeriodPicker, MONTH_LABELS, pickDefaultPeriod, type AvailablePeriod } from "@/components/partner/period-picker";
import { Card } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SponsorModal } from "@/components/partner/sponsor-modal";
import { StatCard } from "@/components/partner/stat-card";
import { WeeklyTransactionsChart, type WeeklyTransactions } from "@/components/partner/weekly-transactions-chart";
import { IncomeTrendChart } from "@/components/partner/income-trend-chart";
import { formatDate, formatDateShort } from "@/lib/utils";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  ArrowLeftOutlined,
  Envelope1Outlined,
  Crown3Outlined,
  BasketShopping3Outlined,
  UserMultiple4Outlined,
  Cart1Outlined,
  Wallet1Outlined,
  CalendarDaysOutlined,
  DollarCircleOutlined,
  Rocket5Outlined,
} from "@lineiconshq/free-icons";

type OrgDetail = {
  id: number;
  name: string;
  logoUrl: string | null;
  createdAt: string;
  timezone: string;
  currency: string;
  linkedAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  industryName: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  planId: number | null;
  planName: string | null;
  lastActivityAt: string;
  status: "ACTIVE" | "INACTIVE" | "DORMANT";
  // Mes/año que se usó para las stat cards "del mes" de abajo — ver
  // statsPeriod en /api/partner/organizations/[id].
  statsPeriod: AvailablePeriod;
  counts: {
    totalSales: number;
    totalProducts: number;
    totalCustomers: number;
    salesThisMonth: number;
  };
  monthsSponsored: number;
  weeklyTransactions: WeeklyTransactions[];
  impact: {
    beforeAvgMonthly: number;
    afterAvgMonthly: number;
    growthPct: number | null;
    hasBaseline: boolean;
    startedFromZero: boolean;
  };
  activityTrendPct: number | null;
  // Gráfico de ingresos/ganancias — SIEMPRE en modo "percent": solo % de
  // variación entre períodos, nunca un monto (ver política de ética de
  // datos financieros, documentation/dashboard.md).
  financialChart: {
    mode: "percent";
    granularity: "month" | "day";
    points: { period: string; income: number | null; profit: number | null }[];
  };
  incomeTrendPct: number | null;
  profitTrendPct: number | null;
  recentSales: {
    id: number;
    saleNumber: string | null;
    soldAt: string;
    status: string | null;
  }[];
};

type OrgDetailResponse = { data: OrgDetail };
type PeriodsResponse = { data: AvailablePeriod[] };

const STATUS_LABEL: Record<OrgDetail["status"], string> = {
  ACTIVE: "Activo",
  INACTIVE: "En riesgo",
  DORMANT: "Inactivos",
};

const STATUS_VARIANT: Record<OrgDetail["status"], "success" | "warning" | "muted"> = {
  ACTIVE: "success",
  INACTIVE: "warning",
  DORMANT: "muted",
};

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [period, setPeriod] = useState("12m");

  // Filtro de mes/año de las stat cards "del mes" (ventas, ingresos,
  // ganancias) — distinto de `period` de arriba, que es el rango del
  // gráfico de tendencia. Solo ofrece meses donde ESTE emprendedor tiene
  // registros (no todo el portafolio, a diferencia del dashboard/lista).
  const { data: periodsData } = usePartnerSWR<PeriodsResponse>(`/api/partner/organizations/${id}/periods`);
  const periods = periodsData?.data ?? [];
  const [statsPeriod, setStatsPeriod] = useState<AvailablePeriod | null>(null);
  useEffect(() => {
    if (statsPeriod || periods.length === 0) return;
    setStatsPeriod(pickDefaultPeriod(periods));
  }, [periods, statsPeriod]);

  const detailUrl = `/api/partner/organizations/${id}?period=${period}${
    statsPeriod ? `&year=${statsPeriod.year}&month=${statsPeriod.month}` : ""
  }`;
  const { data, isLoading, isValidating, error, mutate } = usePartnerSWR<OrgDetailResponse>(detailUrl);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const org = data?.data;
  const statsPeriodLabel = org ? `${MONTH_LABELS[org.statsPeriod.month - 1]} ${org.statsPeriod.year}` : "";

  // Header con la identidad de la org — registrado en el slot fijo del
  // layout (ver components/partner/page-header-slot), NO `position:
  // sticky`: eso seguiría viviendo dentro del contenedor con scroll y solo
  // se "engancha" al tope al pasarlo. Este vive fuera del scroll desde el
  // principio, igual que el navbar. Deps explícitas (no el JSX en sí, que
  // sería una referencia nueva cada render) para no reescribir el slot en
  // cada ciclo de render.
  usePageHeader(
    () =>
      org ? (
        <div className="card-elevated flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-card px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chip-blue-bg text-lg font-extrabold text-chip-blue">
                {org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold">{org.name}</h1>
              <p className="text-sm text-muted-foreground">
                {org.ownerName ?? org.ownerEmail ?? "Sin propietario asignado"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {org.industryName && <Badge variant="muted">{org.industryName}</Badge>}
            {org.planName && (
              <Badge variant="muted">
                <Lineicons icon={Crown3Outlined} size={12} />
                {org.planName}
              </Badge>
            )}
            <Badge variant={STATUS_VARIANT[org.status]}>{STATUS_LABEL[org.status]}</Badge>
            <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setSponsorOpen(true)}>
              <Lineicons icon={Wallet1Outlined} size={13} />
              Patrocinar meses
            </Button>
          </div>
        </div>
      ) : null,
    [org?.id, org?.name, org?.logoUrl, org?.ownerName, org?.ownerEmail, org?.industryName, org?.planName, org?.status]
  );

  if (isLoading) return <PageSpinner />;

  if (error || !data || !org) {
    return (
      <div>
        <BackLink />
        <p className="mt-4 text-sm text-muted-foreground">
          No se pudo cargar este emprendedor — puede que no esté en tu portafolio.
        </p>
      </div>
    );
  }

  return (
    <div>
      <BackLink />

      <ImpactBanner impact={org.impact} activityTrendPct={org.activityTrendPct} />

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">Estadísticas del mes</p>
        {periods.length > 0 && (
          <PeriodPicker periods={periods} value={statsPeriod ?? periods[0]} onChange={setStatsPeriod} />
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ventas totales" value={org.counts.totalSales} icon={Cart1Outlined} tone="blue" />
        <StatCard
          title="Ventas del mes"
          value={org.counts.salesThisMonth}
          subtitle={statsPeriodLabel}
          icon={Cart1Outlined}
          tone="purple"
        />
        <StatCard
          title="Productos activos"
          value={org.counts.totalProducts}
          icon={BasketShopping3Outlined}
          tone="amber"
        />
        <StatCard
          title="Clientes"
          value={org.counts.totalCustomers}
          icon={UserMultiple4Outlined}
          tone="green"
        />
      </div>

      {/* Nunca se muestra el monto (ver política de ética de datos
          financieros) — solo el % de variación vs el mes anterior,
          calculado sobre el valor real de la org. Por eso ya no está
          gateado por shareFinancials: siempre se puede mostrar un %. */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title="Crecimiento en ingresos"
          value={org.incomeTrendPct !== null ? `${org.incomeTrendPct >= 0 ? "+" : ""}${org.incomeTrendPct}%` : "—"}
          subtitle={`${statsPeriodLabel} vs mes anterior`}
          icon={DollarCircleOutlined}
          tone="blue"
        />
        <StatCard
          title="Crecimiento en ganancia"
          value={org.profitTrendPct !== null ? `${org.profitTrendPct >= 0 ? "+" : ""}${org.profitTrendPct}%` : "—"}
          subtitle={`${statsPeriodLabel} vs mes anterior`}
          icon={Wallet1Outlined}
          tone="green"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklyTransactionsChart weeks={org.weeklyTransactions} />

        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <PeriodSelect value={period} onChange={setPeriod} />
          </div>
          {/* Este gráfico siempre viene en modo "percent" — nunca un monto,
              solo % de variación entre períodos (ver política de ética de
              datos financieros). opacity baja mientras se revalida el
              nuevo período — evita el parpadeo de "Cargando…" de página
              completa (keepPreviousData en usePartnerSWR mantiene el
              gráfico anterior visible mientras tanto). */}
          <div className={isValidating ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <IncomeTrendChart
              months={org.financialChart.points.map((p) => ({
                month: p.period,
                income: p.income,
                profit: p.profit,
              }))}
              mode={org.financialChart.mode}
              granularity={org.financialChart.granularity}
              showProfit
              note="Por política de privacidad se muestra la variación % entre períodos, nunca montos."
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-x-auto">
          <div className="p-5 pb-1">
            <p className="text-sm font-medium text-muted-foreground">Últimas ventas</p>
          </div>
          {org.recentSales.length === 0 ? (
            <p className="px-5 pb-5 pt-2 text-sm text-muted-foreground">Todavía no hay ventas registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-semibold">Venta</th>
                  <th className="px-5 py-2 font-semibold">Fecha</th>
                  <th className="px-5 py-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {org.recentSales.map((sale) => (
                  <tr key={sale.id} className="border-t border-border">
                    <td className="px-5 py-2.5 font-semibold">{sale.saleNumber ?? `#${sale.id}`}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{formatDateShort(sale.soldAt)}</td>
                    <td className="px-5 py-2.5 text-muted-foreground capitalize">{sale.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <p className="text-sm font-medium text-muted-foreground">Contacto</p>
          <div className="flex items-center gap-2 text-sm">
            <Lineicons icon={Envelope1Outlined} size={16} className="text-muted-foreground" />
            {org.ownerEmail ? (
              <a href={`mailto:${org.ownerEmail}`} className="font-semibold text-primary hover:underline">
                {org.ownerEmail}
              </a>
            ) : (
              <span className="text-muted-foreground">Sin correo registrado</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Lineicons icon={CalendarDaysOutlined} size={16} className="text-muted-foreground" />
            <span>Vinculado desde {formatDate(org.linkedAt)}</span>
          </div>
          {org.monthsSponsored > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Lineicons icon={Wallet1Outlined} size={16} className="text-muted-foreground" />
              <span>
                {org.monthsSponsored} mes{org.monthsSponsored === 1 ? "" : "es"} patrocinado
                {org.monthsSponsored === 1 ? "" : "s"} por ti
              </span>
            </div>
          )}
        </Card>
      </div>

      <SponsorModal
        open={sponsorOpen}
        onClose={() => setSponsorOpen(false)}
        onSuccess={() => mutate()}
        orgId={org.id}
        orgName={org.name}
      />
    </div>
  );
}

// Lo más importante para el partner: crecimiento en actividad (ventas +
// transacciones, SIN montos) desde que la org se unió a su portafolio — ver
// lib/impact.ts. Va primero en la página, arriba de las stat cards de
// conteo, porque es el número que más le importa mostrarle a su directiva.
function ImpactBanner({
  impact,
  activityTrendPct,
}: {
  impact: OrgDetail["impact"];
  activityTrendPct: number | null;
}) {
  let headline: string;
  let detail: string;

  if (!impact.hasBaseline) {
    headline = "Necesita más tiempo";
    detail = "Se unió a tu portafolio hace poco — todavía no hay suficiente historial antes de vincularse para medir impacto.";
  } else if (impact.startedFromZero) {
    headline = "Empezó a operar";
    detail = `Sin actividad antes de unirse a tu portafolio — ahora registra ~${impact.afterAvgMonthly}/mes.`;
  } else if (impact.growthPct !== null) {
    headline = `${impact.growthPct >= 0 ? "+" : ""}${impact.growthPct}%`;
    detail = `~${impact.beforeAvgMonthly}/mes antes de unirse → ~${impact.afterAvgMonthly}/mes después.`;
  } else {
    headline = "Sin actividad";
    detail = "Todavía no registra ventas ni transacciones.";
  }

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-chip-green-bg">
            <Lineicons icon={Rocket5Outlined} size={20} color="var(--chip-green)" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Impacto desde que se unió a tu portafolio</p>
            <p className="mt-0.5 text-2xl font-extrabold tracking-tight">{headline}</p>
          </div>
        </div>
        <TrendBadge pct={activityTrendPct} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </Card>
  );
}

// Mismo criterio que el badge de tendencia de /dashboard: null cuando no
// hay mes anterior con datos para comparar — nunca se inventa un %.
function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  return (
    <Badge variant={pct >= 0 ? "success" : "warning"}>
      {pct >= 0 ? "+" : ""}
      {pct}% vs mes anterior
    </Badge>
  );
}

// Mismas 5 opciones que PERIOD_PRESETS en /api/partner/organizations/[id] —
// si se agrega una acá hay que agregarla también del lado de la API.
const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
];

function PeriodSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Select value={value} onChange={onChange} options={PERIOD_OPTIONS} />;
}

function BackLink() {
  return (
    <Link
      href="/organizations"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <Lineicons icon={ArrowLeftOutlined} size={14} />
      Emprendedores
    </Link>
  );
}
