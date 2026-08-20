"use client";

import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { StatCard } from "@/components/partner/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  UserMultiple4Outlined,
  User4Outlined,
  BarChart4Outlined,
  DollarCircleOutlined,
  Bell1Outlined,
  Buildings1Outlined,
  Rocket5Outlined,
} from "@lineiconshq/free-icons";

type SectorSlice = { industryId: number | null; industryName: string; count: number; pct: number };

type DashboardResponse = {
  data: {
    partner: string;
    summary: {
      totalOrganizations: number;
      activeOrganizations: number;
      inactiveOrganizations: number;
      dormantOrganizations: number;
      adoptionRate: number;
      alertsCount: number;
      totalIncomeThisMonth: number;
      incomeTrendPct: number | null;
      incomeOrgsSharing: number;
      transactionsThisMonth: number;
      avgImpactPct: number | null;
      impactOrgsCount: number;
    };
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
  const { data, isLoading } = usePartnerSWR<DashboardResponse>("/api/partner/dashboard");

  if (isLoading || !data) return <PageSpinner />;

  const { summary, sectorBreakdown, partner, lastUpdated } = data.data;
  const adoption = adoptionStatus(summary.adoptionRate);
  const trend = summary.incomeTrendPct;
  const total = summary.totalOrganizations || 1; // evita división por 0 en la barra

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Resumen — {partner}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Última actualización: {new Date(lastUpdated).toLocaleString("es-HN")}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* KPI 0 — Impacto del partner: crecimiento en actividad (sin
            montos) desde que cada org se unió al portafolio, promediado.
            Es el número que más le importa mostrarle a su directiva. */}
        <StatCard
          title="Impacto del portafolio"
          value={
            summary.avgImpactPct !== null
              ? `${summary.avgImpactPct >= 0 ? "+" : ""}${summary.avgImpactPct}%`
              : "—"
          }
          subtitle={
            summary.impactOrgsCount > 0
              ? `Crecimiento en actividad de ${summary.impactOrgsCount} org${summary.impactOrgsCount === 1 ? "" : "s"} desde que se unieron a vos`
              : "Todavía no hay suficiente historial para medir impacto"
          }
          icon={Rocket5Outlined}
          tone="green"
        />

        {/* KPI 1 — Tasa de adopción */}
        <StatCard
          title="Tasa de adopción"
          value={`${summary.adoptionRate}%`}
          subtitle={`${summary.activeOrganizations} de ${summary.totalOrganizations} activos`}
          icon={BarChart4Outlined}
          tone="purple"
          badge={<Badge variant={adoption.variant}>{adoption.label}</Badge>}
        />

        {/* KPI 3 — Ingresos totales reportados (solo orgs con share_financials) */}
        <StatCard
          title="Ingresos reportados"
          value={formatCurrency(summary.totalIncomeThisMonth)}
          subtitle={
            summary.incomeOrgsSharing > 0
              ? `Este mes · de ${summary.incomeOrgsSharing} org${summary.incomeOrgsSharing === 1 ? "" : "s"} que comparten datos`
              : "Ningún emprendedor autorizó compartir montos todavía"
          }
          icon={DollarCircleOutlined}
          tone="green"
          badge={
            trend !== null ? (
              <Badge variant={trend >= 0 ? "success" : "warning"}>
                {trend >= 0 ? "+" : ""}
                {trend}% vs mes anterior
              </Badge>
            ) : undefined
          }
        />

        {/* KPI 4 — Volumen de transacciones */}
        <StatCard
          title="Transacciones"
          value={summary.transactionsThisMonth}
          subtitle="Este mes, todo el portafolio"
          icon={UserMultiple4Outlined}
          tone="blue"
        />

        {/* KPI 5 — En alerta */}
        <StatCard
          title="En alerta"
          value={summary.alertsCount}
          subtitle="Sin actividad hace 30+ días — necesitan seguimiento"
          icon={Bell1Outlined}
          tone="amber"
        />

        {/* KPI 2 — Activos / Inactivos / Dormant */}
        <Card className="p-5 sm:col-span-2 lg:col-span-1">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-chip-blue-bg">
            <Lineicons icon={User4Outlined} size={20} color="var(--chip-blue)" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Estado del portafolio</p>

          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-chip-green"
              style={{ width: `${(summary.activeOrganizations / total) * 100}%` }}
            />
            <div
              className="bg-chip-amber"
              style={{ width: `${(summary.inactiveOrganizations / total) * 100}%` }}
            />
            <div
              className="bg-destructive"
              style={{ width: `${(summary.dormantOrganizations / total) * 100}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-chip-green" />
              {summary.activeOrganizations} activos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-chip-amber" />
              {summary.inactiveOrganizations} inactivos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              {summary.dormantOrganizations} dormant
            </span>
          </div>
        </Card>

        {/* KPI 6 — Distribución por sector/industria (sección 14 de
            ideas-feasibility.md). Sin gate de share_financials: es solo un
            conteo de organizaciones por industria, no revela montos. */}
        <Card className="p-5 sm:col-span-2 lg:col-span-2">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-chip-purple-bg">
            <Lineicons icon={Buildings1Outlined} size={20} color="var(--chip-purple)" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Distribución por sector</p>

          {sectorBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Todavía no hay organizaciones en tu portafolio.</p>
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
    </div>
  );
}
