"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/partner/stat-card";
import { WeeklyTransactionsChart, type WeeklyTransactions } from "@/components/partner/weekly-transactions-chart";
import { IncomeTrendChart, type IncomeMonth } from "@/components/partner/income-trend-chart";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/utils";
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
} from "@lineiconshq/free-icons";

type OrgDetail = {
  id: number;
  name: string;
  logoUrl: string | null;
  createdAt: string;
  timezone: string;
  currency: string;
  shareFinancials: boolean;
  linkedAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  planName: string | null;
  lastActivityAt: string;
  status: "ACTIVE" | "INACTIVE" | "DORMANT";
  counts: {
    totalSales: number;
    totalProducts: number;
    totalCustomers: number;
    salesThisMonth: number;
  };
  monthsSponsored: number;
  weeklyTransactions: WeeklyTransactions[];
  monthlyIncome: IncomeMonth[];
  recentSales: {
    id: number;
    saleNumber: string | null;
    soldAt: string;
    status: string | null;
    total: number | null;
  }[];
};

type OrgDetailResponse = { data: OrgDetail };

const STATUS_LABEL: Record<OrgDetail["status"], string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  DORMANT: "Dormant",
};

const STATUS_VARIANT: Record<OrgDetail["status"], "success" | "warning" | "muted"> = {
  ACTIVE: "success",
  INACTIVE: "warning",
  DORMANT: "muted",
};

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = usePartnerSWR<OrgDetailResponse>(`/api/partner/organizations/${id}`);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  if (error || !data) {
    return (
      <div>
        <BackLink />
        <p className="mt-4 text-sm text-muted-foreground">
          No se pudo cargar esta organización — puede que no esté en tu portafolio.
        </p>
      </div>
    );
  }

  const org = data.data;

  return (
    <div>
      <BackLink />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
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
          {org.planName && (
            <Badge variant="muted">
              <Lineicons icon={Crown3Outlined} size={12} />
              {org.planName}
            </Badge>
          )}
          <Badge variant={STATUS_VARIANT[org.status]}>{STATUS_LABEL[org.status]}</Badge>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ventas totales" value={org.counts.totalSales} icon={Cart1Outlined} tone="blue" />
        <StatCard
          title="Ventas este mes"
          value={org.counts.salesThisMonth}
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

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklyTransactionsChart weeks={org.weeklyTransactions} />

        {org.shareFinancials ? (
          <IncomeTrendChart months={org.monthlyIncome} title="Histórico de ingresos — últimos 12 meses" />
        ) : (
          <Card className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Lineicons icon={Wallet1Outlined} size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">Ingresos no disponibles</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Este emprendedor no autorizó compartir sus montos. Solo ves actividad y adopción.
            </p>
          </Card>
        )}
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
                  <th className="px-5 py-2 font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {org.recentSales.map((sale) => (
                  <tr key={sale.id} className="border-t border-border">
                    <td className="px-5 py-2.5 font-semibold">{sale.saleNumber ?? `#${sale.id}`}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{formatDateShort(sale.soldAt)}</td>
                    <td className="px-5 py-2.5 text-muted-foreground capitalize">{sale.status ?? "—"}</td>
                    <td className="px-5 py-2.5">
                      {sale.total !== null ? (
                        formatCurrency(sale.total)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
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
    </div>
  );
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
