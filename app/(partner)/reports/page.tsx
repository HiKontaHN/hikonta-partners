"use client";

import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { StatCard } from "@/components/partner/stat-card";
import { AdoptionTrendChart, type AdoptionMonth } from "@/components/partner/adoption-trend-chart";
import { IncomeTrendChart } from "@/components/partner/income-trend-chart";
import { BarChart4Outlined, UserMultiple4Outlined, User4Outlined } from "@lineiconshq/free-icons";

type AdoptionResponse = {
  data: {
    totalEnrolled: number;
    activeUsers: number;
    inactiveUsers: number;
    adoptionRate: number;
    period: string;
    recommendation: "GOOD" | "MODERATE" | "NEEDS_ATTENTION";
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

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Cargando…</p>;

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
    </div>
  );
}
