"use client";

import { useEffect, useState } from "react";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { usePageHeader } from "@/components/partner/page-header-slot";
import { StatCard } from "@/components/partner/stat-card";
import { PeriodPicker, MONTH_LABELS, pickDefaultPeriod, type AvailablePeriod } from "@/components/partner/period-picker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { PageSpinner } from "@/components/ui/spinner";
import { formatRelativeDays } from "@/lib/utils";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  UserMultiple4Outlined,
  User4Outlined,
  TrendUp1Outlined,
  Bell1Outlined,
  Buildings1Outlined,
  Rocket5Outlined,
  QuestionMarkCircleOutlined,
} from "@lineiconshq/free-icons";

type SectorSlice = { industryId: number | null; industryName: string; count: number; pct: number };
type TopGrowthOrg = { id: number; name: string; growthPct: number };
type TopGrowthSector = { industryId: number | null; industryName: string; avgGrowthPct: number };
type OrgActivity = { id: number; name: string; status: "active" | "inactive" | "dormant"; lastActivityAt: string };

type PeriodsResponse = { data: AvailablePeriod[] };

type DashboardResponse = {
  data: {
    partner: string;
    period: AvailablePeriod;
    summary: {
      totalOrganizations: number;
      activeOrganizations: number;
      inactiveOrganizations: number;
      dormantOrganizations: number;
      adoptionRate: number;
      alertsCount: number;
      alertOrgs: { name: string; status: "inactive" | "dormant" }[];
      transactionsThisMonth: number;
      // Todas las métricas de acá son % o rankings — nunca un monto (ver
      // documentation/dashboard.md, política de ética de datos financieros).
      incomeGrowthPct: number | null;
      pctOrgsIncreasedSales: number | null;
      orgsIncreasedSalesCount: number;
      avgProfitGrowthPct: number | null;
      profitGrowthOrgsCount: number;
      topGrowthSector: TopGrowthSector | null;
    };
    topGrowthOrganizations: TopGrowthOrg[];
    orgActivity: OrgActivity[];
    sectorBreakdown: SectorSlice[];
    lastUpdated: string;
  };
};

// Paleta fija para las barras de sector — solo azul/verde (con una
// variante más clara de cada uno) ciclada si hay más sectores que colores.
// Ver feedback de diseño 2026-08-23: nada de amber/purple/rojo decorativo.
const SECTOR_COLORS = [
  "bg-chip-blue", "bg-chip-green", "bg-chip-blue/55", "bg-chip-green/55",
];

// Mismo semáforo verde/amarillo/rojo que la barra de "Estado del
// portafolio" — un solo lugar para no repetir el mapeo status → color.
const STATUS_DOT: Record<OrgActivity["status"], string> = {
  active: "bg-chip-green",
  inactive: "bg-chip-amber",
  dormant: "bg-destructive",
};

// Umbrales del KPI de adopción — ver documentation/dashboard.md
function adoptionStatus(rate: number) {
  if (rate > 70) return { label: "Excelente", variant: "success" as const };
  if (rate >= 50) return { label: "Moderado", variant: "warning" as const };
  return { label: "Necesita atención", variant: "warning" as const };
}

// Valor de una StatCard de crecimiento — verde solo cuando el % es
// positivo (el único color con significado real que queda en las cards,
// ver feedback de diseño 2026-08-23: nada de íconos de colores variados).
function TrendValue({ pct }: { pct: number | null }) {
  if (pct === null) return "—";
  return (
    <span style={pct >= 0 ? { color: "var(--chip-green)" } : undefined}>
      {pct >= 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

export default function DashboardPage() {
  // Meses/años con registros reales en el portafolio — ver lib/periods.ts.
  // Alimenta los selects de abajo para que el partner solo pueda elegir un
  // período que sí tiene datos.
  const { data: periodsData } = usePartnerSWR<PeriodsResponse>("/api/partner/dashboard/periods");
  const periods = periodsData?.data ?? [];

  const [period, setPeriod] = useState<AvailablePeriod | null>(null);

  // Default: el mes actual si tiene datos, si no el período disponible más
  // reciente. Solo corre una vez que llegan los períodos y todavía no hay
  // selección explícita del partner.
  useEffect(() => {
    if (period || periods.length === 0) return;
    setPeriod(pickDefaultPeriod(periods));
  }, [periods, period]);

  const dashboardUrl = period
    ? `/api/partner/dashboard?year=${period.year}&month=${period.month}`
    : "/api/partner/dashboard";
  const { data, isLoading } = usePartnerSWR<DashboardResponse>(dashboardUrl);

  // Título + badge de adopción + period picker como header FIJO (mismo
  // patrón que /organizations, ver page-header-slot.tsx) — antes vivía
  // como contenido normal, así que se iba con el scroll. El hook se llama
  // ANTES del early-return de isLoading para no romper el orden de hooks
  // entre el render de carga y el real; mientras no hay datos, no registra
  // nada (el header queda vacío, no hay nada que fijar todavía).
  const adoption = data ? adoptionStatus(data.data.summary.adoptionRate) : null;
  usePageHeader(
    () =>
      data ? (
        <div className="pt-4 sm:pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold">Dashboard — {data.data.partner}</h1>
              <Badge variant={adoption!.variant}>{adoption!.label}</Badge>
            </div>
            {periods.length > 0 && (
              <PeriodPicker periods={periods} value={period ?? periods[0]} onChange={setPeriod} />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Última actualización: {new Date(data.data.lastUpdated).toLocaleString("es-HN")}
          </p>
        </div>
      ) : null,
    [data, adoption?.variant, adoption?.label, periods, period]
  );

  if (isLoading || !data) return <PageSpinner />;

  const { summary, topGrowthOrganizations, orgActivity, sectorBreakdown } = data.data;
  const total = summary.totalOrganizations || 1; // evita división por 0 en la barra
  const periodLabel = `${MONTH_LABELS[data.data.period.month - 1]} ${data.data.period.year}`;

  return (
    <div>
      {/* Crecimiento en base a ingresos — mes vs mes anterior, todo el
          portafolio (fallback a promedio móvil si el mes-1 no tiene datos,
          ver lib/growth.ts). Va destacado arriba de la grilla, con el mismo
          filtro de mes que el resto de la página. Nunca se muestra un
          monto: solo el %, calculado sobre el valor real de ingresos de
          TODAS las orgs (ver política de ética de datos financieros). */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="flex items-center gap-1 text-md font-medium text-muted-foreground">
            Crecimiento en base a ingresos
            <Tooltip content="Compara cuánto vendió en total tu portafolio este mes contra el mes anterior. Si el número es positivo, tus emprendedores en conjunto vendieron más que el mes pasado.">
              <Lineicons icon={QuestionMarkCircleOutlined} size={14} className="cursor-default text-muted-foreground/70" />
            </Tooltip>
          </p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight">
            {summary.incomeGrowthPct !== null
              ? `${summary.incomeGrowthPct >= 0 ? "+" : ""}${summary.incomeGrowthPct}%`
              : "—"}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{periodLabel} · todo el portafolio</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* KPI 1 — Impacto: % de emprendimientos que aumentaron ventas este
            mes vs el anterior. */}
        <StatCard
          title="Impacto del portafolio"
          value={
            summary.pctOrgsIncreasedSales !== null ? `${summary.pctOrgsIncreasedSales}%` : "—"
          }
          subtitle={`${summary.orgsIncreasedSalesCount} de ${summary.totalOrganizations} emprendedores aumentaron ventas`}
          icon={Rocket5Outlined}
          info="De todos los emprendedores en tu portafolio, qué porcentaje vendió más este mes que el mes anterior."
        />

        {/* KPI 2 — Crecimiento: % de crecimiento en ganancia desde que cada
            org se unió al portafolio, promediado mensual (mismo patrón
            antes/después que lib/impact.ts, alimentado con ganancia). */}
        <StatCard
          title="Crecimiento"
          value={<TrendValue pct={summary.avgProfitGrowthPct} />}
          subtitle={
            summary.profitGrowthOrgsCount > 0
              ? `Crecimiento en ganancia de ${summary.profitGrowthOrgsCount} emprendedor${summary.profitGrowthOrgsCount === 1 ? "" : "es"} desde que se unieron`
              : "Todavía no hay suficiente historial para medir crecimiento"
          }
          icon={TrendUp1Outlined}
          info="Compara cuánto ganaban en promedio tus emprendedores antes de unirse a vos contra cuánto ganan ahora — mide el impacto de tu acompañamiento."
        />

        {/* KPI 3 — Sector con más crecimiento: el nombre del sector es el
            valor principal (grande), con el % de crecimiento al lado —
            promedio de % de crecimiento en ganancia de las orgs de ese
            sector. */}
        <StatCard
          title="Sector con más crecimiento"
          value={
            summary.topGrowthSector ? (
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="min-w-0 truncate text-xl">{summary.topGrowthSector.industryName}</span>
                <span
                  className="shrink-0 text-base font-bold"
                  style={summary.topGrowthSector.avgGrowthPct >= 0 ? { color: "var(--chip-green)" } : undefined}
                >
                  {summary.topGrowthSector.avgGrowthPct >= 0 ? "+" : ""}
                  {summary.topGrowthSector.avgGrowthPct}%
                </span>
              </span>
            ) : (
              "—"
            )
          }
          subtitle="Promedio de crecimiento en ganancia por sector"
          icon={Buildings1Outlined}
          info="El rubro cuyos negocios, en promedio, más aumentaron su ganancia desde que se unieron a tu portafolio."
        />

        {/* KPI 4 — 3 emprendimientos en alza, rankeados por % de
            crecimiento en ganancia del mes actual vs el anterior — sin
            importar cuándo se agregaron al partner (a diferencia de la
            card "Crecimiento", que sí depende de la fecha de vinculación). */}
        <TopGrowthCard orgs={topGrowthOrganizations} />

        {/* KPI 5 — Estado del portafolio: activos/en riesgo/inactivos + lista
            de quiénes necesitan atención (en alerta). */}
        <PortfolioStatusCard summary={summary} total={total} />

        {/* KPI 6 — Transacciones + Adopción en una sola card: arriba el
            volumen de transacciones del mes, abajo el detalle de adopción
            (uso de la plataforma) por negocio, ordenado del más al menos
            reciente. */}
        <TransactionsCard summary={summary} orgs={orgActivity} periodLabel={periodLabel} />
      </div>

      {/* Distribución por sector — sección 14 de ideas-feasibility.md. Sin
          gate de share_financials: es solo un conteo de organizaciones por
          industria, no revela montos. */}
      <Card className="mt-4 p-5">
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Lineicons icon={Buildings1Outlined} size={16} className="text-muted-foreground" />
          Distribución por sector
        </p>

        {sectorBreakdown.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Todavía no hay emprendedores en tu portafolio.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {sectorBreakdown.map((s, i) => (
              <div key={s.industryId ?? "sin-sector"} className="flex items-center gap-3 text-xs">
                <span className="w-28 shrink-0 truncate font-semibold sm:w-40">{s.industryName}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                    style={{ width: `${s.pct}%`, height: "100%" }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-muted-foreground">
                  {s.count} · {s.pct}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Tabla resumen de los 3 emprendimientos con más alza en crecimiento —
// pedido explícito del rediseño (dibujo). Rankeados por ganancia del mes
// actual vs el anterior, sin importar cuándo se unieron al partner (ver
// monthProfitGrowthPct en /api/partner/dashboard). Mismo estilo de Card
// que las demás secciones "custom" del dashboard (no encaja en StatCard
// porque necesita listar varias filas).
function TopGrowthCard({ orgs }: { orgs: TopGrowthOrg[] }) {
  return (
    <Card className="p-5">
      <p className="flex items-center gap-1.5 text-md font-medium text-muted-foreground">
        <Lineicons icon={TrendUp1Outlined} size={25} className="shrink-0 text-muted-foreground" />
        Emprendimientos en alza
        <Tooltip content="Los 3 negocios que más aumentaron su ganancia este mes comparado con el mes pasado.">
          <Lineicons icon={QuestionMarkCircleOutlined} size={14} className="cursor-default text-muted-foreground/70" />
        </Tooltip>
      </p>
      <p className="text-sm text-muted-foreground">Ganancia del mes actual vs el anterior</p>

      {orgs.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Todavía no hay suficiente historial para rankear.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {orgs.map((org, i) => (
            <div key={org.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 truncate">
                <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                <span className="truncate font-semibold">{org.name}</span>
              </span>
              <Badge variant={org.growthPct >= 0 ? "success" : "warning"} className="shrink-0">
                {org.growthPct >= 0 ? "+" : ""}
                {org.growthPct}%
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Transacciones + Adopción en una sola card: arriba el volumen del mes
// (con su % de adopción agregado como badge), abajo el detalle por
// negocio — TODOS los del portafolio (no solo los "en alerta" de
// PortfolioStatusCard), ordenados del que usó la plataforma más
// recientemente al que tiene más tiempo sin usarla. Mismo semáforo de
// color que el resto del dashboard. Lista con scroll para no romper el
// layout en portafolios grandes.
function TransactionsCard({
  summary,
  orgs,
  periodLabel,
}: {
  summary: DashboardResponse["data"]["summary"];
  orgs: OrgActivity[];
  periodLabel: string;
}) {
  return (
    <Card className="p-5 sm:col-span-2 lg:col-span-1">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-md font-medium text-muted-foreground">
          <Lineicons icon={UserMultiple4Outlined} size={25} className="shrink-0 text-muted-foreground" />
          Transacciones
          <Tooltip content="Cantidad de ventas registradas este mes por todos los emprendedores de tu portafolio.">
            <Lineicons icon={QuestionMarkCircleOutlined} size={14} className="cursor-default text-muted-foreground/70" />
          </Tooltip>
        </p>
        <Badge variant="muted">{summary.adoptionRate}% adopción</Badge>
      </div>
      <p className="mt-1 text-3xl font-extrabold tracking-tight">{summary.transactionsThisMonth}</p>
      <p className="mt-1 text-sm text-muted-foreground">{periodLabel}, todo el portafolio</p>

      <div className="mt-4 border-t border-border pt-3">
        <p className="flex items-center gap-1 text-md font-semibold text-muted-foreground">
          Adopción
          <Tooltip content="Qué tan seguido usa la plataforma cada negocio. Se ordenan del que vendió más recientemente al que tiene más tiempo sin usarla.">
            <Lineicons icon={QuestionMarkCircleOutlined} size={12} className="cursor-default text-muted-foreground/70" />
          </Tooltip>
        </p>

        {orgs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no hay emprendedores en tu portafolio.</p>
        ) : (
          <ul className="mt-2 flex max-h-64 flex-col gap-2 overflow-y-auto text-sm">
            {orgs.map((org) => (
              <li key={org.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[org.status]}`} />
                  <span className="truncate">{org.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeDays(org.lastActivityAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// Estado del portafolio: barra activos/en riesgo/inactivos (igual que antes)
// + lista de nombres "en alerta" (necesitan atención) debajo.
function PortfolioStatusCard({
  summary,
  total,
}: {
  summary: DashboardResponse["data"]["summary"];
  total: number;
}) {
  return (
    <Card className="p-5 sm:col-span-2 lg:col-span-1">
      <p className="flex items-center gap-1.5 text-md font-medium text-muted-foreground">
        <Lineicons icon={User4Outlined} size={25} className="text-muted-foreground" />
        Estado del portafolio
      </p>

      {/* Semáforo verde/amarillo/rojo por severidad — igual criterio que
          ACTIVE_DAYS/DORMANT_DAYS en /api/partner/dashboard (30/90 días). */}
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-chip-green" style={{ width: `${(summary.activeOrganizations / total) * 100}%` }} />
        <div className="bg-chip-amber" style={{ width: `${(summary.inactiveOrganizations / total) * 100}%` }} />
        <div className="bg-destructive" style={{ width: `${(summary.dormantOrganizations / total) * 100}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Tooltip content="Tuvo una venta o transacción en los últimos 30 días.">
          <span className="flex cursor-default items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-chip-green" />
            {summary.activeOrganizations} activos
          </span>
        </Tooltip>
        <Tooltip content="Sin actividad entre 30 y 90 días — todavía a tiempo de reactivar.">
          <span className="flex cursor-default items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-chip-amber" />
            {summary.inactiveOrganizations} en riesgo
          </span>
        </Tooltip>
        <Tooltip content="Sin actividad hace más de 90 días.">
          <span className="flex cursor-default items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            {summary.dormantOrganizations} inactivos
          </span>
        </Tooltip>
      </div>

      {summary.alertOrgs.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Lineicons icon={Bell1Outlined} size={12} />
            Necesita atención
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs">
            {summary.alertOrgs.slice(0, 4).map((org) => (
              <li key={org.name} className="flex items-center gap-1.5 truncate">
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[org.status]}`} />
                <span className="truncate">{org.name}</span>
              </li>
            ))}
            {summary.alertOrgs.length > 4 && (
              <li className="text-muted-foreground">+{summary.alertOrgs.length - 4} más</li>
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}
