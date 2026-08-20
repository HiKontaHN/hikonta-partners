"use client";

import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { StatCard } from "@/components/partner/stat-card";
import { AdoptionTrendChart, type AdoptionMonth } from "@/components/partner/adoption-trend-chart";
import { IncomeTrendChart } from "@/components/partner/income-trend-chart";
import { Card } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  BarChart4Outlined,
  UserMultiple4Outlined,
  User4Outlined,
  Buildings1Outlined,
  DollarCircleOutlined,
  Briefcase1Outlined,
} from "@lineiconshq/free-icons";

type SectorSlice = { industryId: number | null; industryName: string; count: number; pct: number };

type AdoptionResponse = {
  data: {
    totalEnrolled: number;
    activeUsers: number;
    inactiveUsers: number;
    adoptionRate: number;
    period: string;
    recommendation: "GOOD" | "MODERATE" | "NEEDS_ATTENTION";
    impact: {
      beneficiaries: number;
      totalSalesGenerated: number;
      sectorsBenefited: SectorSlice[];
    };
  };
};

type TrendsResponse = {
  data: { months: (AdoptionMonth & { income: number })[] };
};

const RECOMMENDATION_LABEL: Record<AdoptionResponse["data"]["recommendation"], string> = {
  GOOD: "Excelente",
  MODERATE: "Moderado",
  NEEDS_ATTENTION: "Necesita atención",
};

export default function ReportsPage() {
  const { data, isLoading } = usePartnerSWR<AdoptionResponse>("/api/partner/reports/adoption");
  const { data: trends, isLoading: trendsLoading } = usePartnerSWR<TrendsResponse>("/api/partner/reports/trends");

  if (isLoading || !data) return <PageSpinner />;

  const r = data.data;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Reporte de adopción</h1>
      <p className="mb-6 text-sm text-muted-foreground">{r.period}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Inscritos" value={r.totalEnrolled} icon={UserMultiple4Outlined} tone="blue" />
        <StatCard title="Activos" value={r.activeUsers} icon={User4Outlined} tone="green" />
        <StatCard title="Tasa de adopción" value={`${r.adoptionRate}%`} icon={BarChart4Outlined} tone="purple" />
        <StatCard
          title="Recomendación"
          value={RECOMMENDATION_LABEL[r.recommendation]}
          icon={BarChart4Outlined}
          tone={r.recommendation === "GOOD" ? "green" : r.recommendation === "MODERATE" ? "amber" : "blue"}
        />
      </div>

      {!trendsLoading && trends && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AdoptionTrendChart months={trends.data.months} />
          <IncomeTrendChart months={trends.data.months} />
        </div>
      )}

      {/* Reporte para terceros — sección 19 de ideas-feasibility.md. Pensado
          para que el partner lo muestre tal cual a un patrocinador/fondo:
          beneficiarios, ventas generadas por el ecosistema, y sectores
          beneficiados. Ventas generadas gateado por share_financials igual
          que el resto del panel (viene ya filtrado desde la API). */}
      <div className="mt-6">
        <h2 className="mb-1 text-lg font-semibold">Reporte para terceros</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Resumen listo para compartir con patrocinadores o fondos — histórico completo, no solo
          este período.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Beneficiarios"
            value={r.impact.beneficiaries}
            subtitle="Emprendimientos apoyados"
            icon={Briefcase1Outlined}
            tone="blue"
          />
          <StatCard
            title="Ventas generadas"
            value={formatCurrency(r.impact.totalSalesGenerated)}
            subtitle="Histórico, orgs que comparten datos financieros"
            icon={DollarCircleOutlined}
            tone="green"
          />
          <StatCard
            title="Sectores beneficiados"
            value={r.impact.sectorsBenefited.length}
            subtitle="Industrias distintas en el portafolio"
            icon={Buildings1Outlined}
            tone="purple"
          />
        </div>

        {r.impact.sectorsBenefited.length > 0 && (
          <Card className="mt-4 p-5">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Desglose por sector</p>
            <div className="flex flex-col gap-2.5">
              {r.impact.sectorsBenefited.map((s) => (
                <div key={s.industryId ?? "sin-sector"} className="flex items-center gap-3 text-xs">
                  <span className="w-32 shrink-0 truncate font-semibold sm:w-48">{s.industryName}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-chip-purple" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right text-muted-foreground">
                    {s.count} · {s.pct}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
