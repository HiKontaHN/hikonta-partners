"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { useDebounce } from "@/hooks/use-debounce";
import { usePageHeader } from "@/components/partner/page-header-slot";
import { PeriodPicker, MONTH_LABELS, pickDefaultPeriod, type AvailablePeriod } from "@/components/partner/period-picker";
import { Badge } from "@/components/ui/badge";
import { PageSpinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { InviteModal } from "@/components/partner/invite-modal";
import { formatDateShort } from "@/lib/utils";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  Search1Outlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  Envelope1Outlined,
  HourglassOutlined,
  Buildings1Outlined,
  TrendUp1Outlined,
  TrendDown1Outlined,
} from "@lineiconshq/free-icons";

type OrgRow = {
  id: number;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  industryId: number | null;
  industryName: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  salesThisMonth: number;
  lastActivityAt: string;
  joinedAt: string;
  daysActive: number;
  status: "ACTIVE" | "INACTIVE" | "DORMANT";
  incomeTrendPct: number | null;
};

type OrgsResponse = { data: OrgRow[]; total: number; page: number; pages: number; period: AvailablePeriod };
type PeriodsResponse = { data: AvailablePeriod[] };

// Solo se usa para poblar las opciones del filtro de sector con el conteo
// real del portafolio completo — ya lo calcula /api/partner/dashboard
// (sectorBreakdown), no hace falta un endpoint nuevo para esto.
type SectorSlice = { industryId: number | null; industryName: string; count: number };
type DashboardResponse = { data: { sectorBreakdown: SectorSlice[] } };

const STATUS_LABEL: Record<OrgRow["status"], string> = {
  ACTIVE: "Activo",
  INACTIVE: "En riesgo",
  DORMANT: "Inactivos",
};

const STATUS_VARIANT: Record<OrgRow["status"], "success" | "warning" | "muted"> = {
  ACTIVE: "success",
  INACTIVE: "warning",
  DORMANT: "muted",
};

const INPUT_CLASS =
  "rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring";

export default function OrganizationsPage() {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [industry, setIndustry] = useState("all");
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
  const handleIndustry = useCallback((v: string) => {
    setIndustry(v);
    setPage(1);
  }, []);

  // Filtro de mes/año — mismos períodos disponibles que el dashboard (todo
  // el portafolio), ver lib/periods.ts en el backend.
  const { data: periodsData } = usePartnerSWR<PeriodsResponse>("/api/partner/dashboard/periods");
  const periods = periodsData?.data ?? [];
  const [period, setPeriod] = useState<AvailablePeriod | null>(null);
  useEffect(() => {
    if (period || periods.length === 0) return;
    setPeriod(pickDefaultPeriod(periods));
  }, [periods, period]);
  const handlePeriod = useCallback((p: AvailablePeriod) => {
    setPeriod(p);
    setPage(1);
  }, []);

  const qs = new URLSearchParams({
    search: debouncedSearch,
    status,
    industry,
    page: String(page),
    ...(period ? { year: String(period.year), month: String(period.month) } : {}),
  }).toString();

  const { data, isLoading, mutate } = usePartnerSWR<OrgsResponse>(`/api/partner/organizations?${qs}`);
  const { data: dashboardData } = usePartnerSWR<DashboardResponse>("/api/partner/dashboard");
  const sectors = dashboardData?.data.sectorBreakdown ?? [];

  const hasFilters = search !== "" || status !== "all" || industry !== "all";
  const periodLabel = data ? `${MONTH_LABELS[data.period.month - 1]} ${data.period.year}` : "";

  // Título + acción + filtros — registrado en el slot fijo del layout (ver
  // components/partner/page-header-slot), NO `position: sticky`, mismo
  // criterio que el header de organizations/[id]. Los filtros son inputs
  // controlados por estado propio de esta página, así que a diferencia del
  // detalle de organización (donde las deps eran solo identidad), acá SÍ
  // hace falta recalcular en cada tecla para que el valor mostrado no quede
  // desfasado.
  usePageHeader(
    () => (
      <div className="card-elevated rounded-2xl bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Emprendedores</h1>
            <p className="text-sm text-muted-foreground">Emprendedores vinculados a tu portafolio.</p>
          </div>
          <div className="flex items-center gap-2">
            {periods.length > 0 && (
              <PeriodPicker periods={periods} value={period ?? periods[0]} onChange={handlePeriod} />
            )}
            <Button type="button" onClick={() => setInviteOpen(true)}>
              + Agregar emprendedor
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Lineicons icon={Search1Outlined} size={15} />
            </span>
            <input
              placeholder="Buscar por negocio o propietario…"
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
              { value: "ACTIVE", label: "Activo" },
              { value: "INACTIVE", label: "En riesgo" },
              { value: "DORMANT", label: "Inactivos" },
            ]}
          />
          <Select
            value={industry}
            onChange={handleIndustry}
            className="sm:w-56"
            options={[
              { value: "all", label: "Todos los sectores" },
              ...sectors.map((s) => ({
                value: s.industryId === null ? "none" : String(s.industryId),
                label: `${s.industryName} (${s.count})`,
              })),
            ]}
          />
        </div>
      </div>
    ),
    [search, status, industry, sectors, handleSearch, handleStatus, handleIndustry, periods, period, handlePeriod]
  );

  return (
    <div>
      {isLoading && <PageSpinner />}

      {data && data.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? "Ningún emprendedor coincide con ese filtro."
            : "Todavía no hay emprendedores vinculados a tu portafolio."}
        </p>
      )}

      {data && data.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.data.map((org) => (
            <OrgCard
              key={org.id}
              org={org}
              periodLabel={periodLabel}
              onClick={() => router.push(`/organizations/${org.id}`)}
            />
          ))}
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {data.page} de {data.pages} · {data.total} organizaci{data.total === 1 ? "ón" : "ones"}
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

      <InviteModal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          mutate();
        }}
      />
    </div>
  );
}

function OrgCard({ org, periodLabel, onClick }: { org: OrgRow; periodLabel: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="card-elevated cursor-pointer rounded-xl bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold">{org.name}</p>
          {(org.ownerName || org.ownerEmail) && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Lineicons icon={Envelope1Outlined} size={12} />
              {org.ownerName ?? org.ownerEmail}
            </p>
          )}
        </div>
        <Badge variant={STATUS_VARIANT[org.status]} className="shrink-0">
          {STATUS_LABEL[org.status]}
        </Badge>
      </div>

      {org.industryName && (
        <Badge variant="muted" className="mb-3">
          <Lineicons icon={Buildings1Outlined} size={11} />
          {org.industryName}
        </Badge>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-border pt-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Última actividad</p>
          <p className="mt-0.5 flex items-center gap-1 font-medium">
            <Lineicons icon={HourglassOutlined} size={12} className="text-muted-foreground" />
            {formatDateShort(org.lastActivityAt)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Transacciones</p>
          <p className="mt-0.5 font-medium">{org.salesThisMonth} en {periodLabel}</p>
        </div>
        {/* Nunca se muestra el monto de ingresos (ver política de ética de
            datos financieros) — solo la tendencia %, calculada sobre el
            valor real de la org. null si no hay mes anterior con datos. */}
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Crecimiento en ingresos</p>
          {org.incomeTrendPct !== null ? (
            <p
              className={`mt-0.5 flex items-center gap-1 font-medium ${
                org.incomeTrendPct >= 0 ? "text-chip-green" : "text-destructive"
              }`}
            >
              <Lineicons icon={org.incomeTrendPct >= 0 ? TrendUp1Outlined : TrendDown1Outlined} size={12} />
              {org.incomeTrendPct >= 0 ? "+" : ""}
              {org.incomeTrendPct}% vs mes anterior
            </p>
          ) : (
            <p className="mt-0.5 text-muted-foreground">—</p>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{org.daysActive}d en HiKonta</p>
    </div>
  );
}
