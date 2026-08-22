"use client";

import { useEffect, useState } from "react";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { StatCard } from "@/components/partner/stat-card";
import { PeriodPicker, MONTH_LABELS, pickDefaultPeriod, type AvailablePeriod } from "@/components/partner/period-picker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  UserMultiple4Outlined,
  User4Outlined,
  TrendUp1Outlined,
  Bell1Outlined,
  Buildings1Outlined,
  Rocket5Outlined,
} from "@lineiconshq/free-icons";

type SectorSlice = { industryId: number | null; industryName: string; count: number; pct: number };
type TopGrowthOrg = { id: number; name: string; growthPct: number };
type TopGrowthSector = { industryId: number | null; industryName: string; avgGrowthPct: number };

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
      alertOrgNames: string[];
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
    sectorBreakdown: SectorSlice[];
    lastUpdated: string;
  };
};

// Paleta fija para las barras de sector — mismo set de tonos "chip" que ya
// usa el resto del panel, ciclada si hay más sectores que colores.
const SECTOR_COLORS = [
  "bg-chip-blue", "bg-chip-green", "bg-chip-amber", "bg-chip-purple", "bg-destructive",
];

// Umbrales del KPI de adopción — ver documentation/dashboard.md
function adoptionStatus(rate: number) {
  if (rate > 70) return { label: "Excelente", variant: "success" as const };
  if (rate >= 50) return { label: "Moderado", variant: "warning" as const };
  return { label: "Necesita atención", variant: "warning" as const };
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

  if (isLoading || !data) return <PageSpinner />;

  const { summary, topGrowthOrganizations, sectorBreakdown, partner, lastUpdated } = data.data;
  const adoption = adoptionStatus(summary.adoptionRate);
  const total = summary.totalOrganizations || 1; // evita división por 0 en la barra
  const periodLabel = `${MONTH_LABELS[data.data.period.month - 1]} ${data.data.period.year}`;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Dashboard — {partner}</h1>
          <Badge variant={adoption.variant}>{adoption.label}</Badge>
        </div>
        {periods.length > 0 && (
          <PeriodPicker periods={periods} value={period ?? periods[0]} onChange={setPeriod} />
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Última actualización: {new Date(lastUpdated).toLocaleString("es-HN")}
      </p>

      {/* Crecimiento en base a ingresos — mes vs mes anterior, todo el
          portafolio (fallback a promedio móvil si el mes-1 no tiene datos,
          ver lib/growth.ts). Va destacado arriba de la grilla, con el mismo
          filtro de mes que el resto de la página. Nunca se muestra un
          monto: solo el %, calculado sobre el valor real de ingresos de
          TODAS las orgs (ver política de ética de datos financieros). */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Crecimiento en base a ingresos</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight">
            {summary.incomeGrowthPct !== null
              ? `${summary.incomeGrowthPct >= 0 ? "+" : ""}${summary.incomeGrowthPct}%`
              : "—"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{periodLabel} · todo el portafolio</p>
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
          tone="green"
        />

        {/* KPI 2 — Crecimiento: % de crecimiento en ganancia desde que cada
            org se unió al portafolio, promediado mensual (mismo patrón
            antes/después que lib/impact.ts, alimentado con ganancia). */}
        <StatCard
          title="Crecimiento"
          value={
            summary.avgProfitGrowthPct !== null
              ? `${summary.avgProfitGrowthPct >= 0 ? "+" : ""}${summary.avgProfitGrowthPct}%`
              : "—"
          }
          subtitle={
            summary.profitGrowthOrgsCount > 0
              ? `Crecimiento en ganancia de ${summary.profitGrowthOrgsCount} emprendedor${summary.profitGrowthOrgsCount === 1 ? "" : "es"} desde que se unieron`
              : "Todavía no hay suficiente historial para medir crecimiento"
          }
          icon={TrendUp1Outlined}
          tone="blue"
        />

        {/* KPI 3 — Sector con más crecimiento: badge con el nombre de la
            industria, no un monto — promedio de % de crecimiento en
            ganancia de las orgs de ese sector. */}
        <StatCard
          title="Sector con más crecimiento"
          value={
            summary.topGrowthSector
              ? `${summary.topGrowthSector.avgGrowthPct >= 0 ? "+" : ""}${summary.topGrowthSector.avgGrowthPct}%`
              : "—"
          }
          subtitle="Promedio de crecimiento en ganancia por sector"
          icon={Buildings1Outlined}
          tone="purple"
          badge={
            summary.topGrowthSector ? (
              <Badge variant="muted">{summary.topGrowthSector.industryName}</Badge>
            ) : undefined
          }
        />

        {/* KPI 4 — 3 emprendimientos en alza, rankeados por % de
            crecimiento en ganancia del mes actual vs el anterior — sin
            importar cuándo se agregaron al partner (a diferencia de la
            card "Crecimiento", que sí depende de la fecha de vinculación). */}
        <TopGrowthCard orgs={topGrowthOrganizations} />

        {/* KPI 5 — Transacciones + tasa de adopción */}
        <StatCard
          title="Transacciones"
          value={summary.transactionsThisMonth}
          subtitle={`${periodLabel}, todo el portafolio`}
          icon={UserMultiple4Outlined}
          tone="amber"
          badge={<Badge variant="muted">{summary.adoptionRate}% adopción</Badge>}
        />

        {/* KPI 6 — Estado del portafolio: activos/en riesgo/inactivos + lista
            de quiénes necesitan atención (en alerta). */}
        <PortfolioStatusCard summary={summary} total={total} />
      </div>

      {/* Distribución por sector — sección 14 de ideas-feasibility.md. Sin
          gate de share_financials: es solo un conteo de organizaciones por
          industria, no revela montos. */}
      <Card className="mt-4 p-5">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-chip-purple-bg">
          <Lineicons icon={Buildings1Outlined} size={20} color="var(--chip-purple)" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Distribución por sector</p>

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
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-chip-green-bg">
        <Lineicons icon={TrendUp1Outlined} size={20} color="var(--chip-green)" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Emprendimientos en alza</p>
      <p className="text-xs text-muted-foreground">Ganancia del mes actual vs el anterior</p>

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
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-chip-blue-bg">
        <Lineicons icon={User4Outlined} size={20} color="var(--chip-blue)" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Estado del portafolio</p>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-chip-green" style={{ width: `${(summary.activeOrganizations / total) * 100}%` }} />
        <div className="bg-chip-amber" style={{ width: `${(summary.inactiveOrganizations / total) * 100}%` }} />
        <div className="bg-destructive" style={{ width: `${(summary.dormantOrganizations / total) * 100}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-chip-green" />
          {summary.activeOrganizations} activos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-chip-amber" />
          {summary.inactiveOrganizations} en riesgo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          {summary.dormantOrganizations} inactivos
        </span>
      </div>

      {summary.alertOrgNames.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Lineicons icon={Bell1Outlined} size={12} />
            Necesita atención
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs">
            {summary.alertOrgNames.slice(0, 4).map((name) => (
              <li key={name} className="truncate">
                {name}
              </li>
            ))}
            {summary.alertOrgNames.length > 4 && (
              <li className="text-muted-foreground">+{summary.alertOrgNames.length - 4} más</li>
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}
