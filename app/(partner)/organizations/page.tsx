"use client";

import { useRouter } from "next/navigation";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateShort } from "@/lib/utils";

type OrgRow = {
  id: number;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  salesThisMonth: number;
  lastActivityAt: string;
  joinedAt: string;
  daysActive: number;
  status: "ACTIVE" | "INACTIVE" | "DORMANT";
  shareFinancials: boolean;
  incomeThisMonth: number | null;
  incomeTrendPct: number | null;
};

type OrgsResponse = { data: OrgRow[]; total: number };

const STATUS_LABEL: Record<OrgRow["status"], string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  DORMANT: "Dormant",
};

const STATUS_VARIANT: Record<OrgRow["status"], "success" | "warning" | "muted"> = {
  ACTIVE: "success",
  INACTIVE: "warning",
  DORMANT: "muted",
};

export default function OrganizationsPage() {
  const router = useRouter();
  const { data, isLoading } = usePartnerSWR<OrgsResponse>("/api/partner/organizations");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Emprendedores</h1>

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
                <th className="px-3 py-3 font-semibold sm:px-5">Última actividad</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Transacciones</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Ingresos</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Tendencia</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Días activo</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((org) => (
                <tr
                  key={org.id}
                  onClick={() => router.push(`/organizations/${org.id}`)}
                  className="cursor-pointer border-t border-border first:border-0 hover:bg-muted/50"
                >
                  <td className="px-3 py-3 font-bold sm:px-5">{org.name}</td>
                  <td className="px-3 py-3 text-muted-foreground sm:px-5">
                    {org.ownerName ?? org.ownerEmail ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground sm:px-5">
                    {formatDateShort(org.lastActivityAt)}
                  </td>
                  <td className="px-3 py-3 sm:px-5">{org.salesThisMonth}</td>
                  <td className="px-3 py-3 sm:px-5">
                    {org.shareFinancials ? (
                      formatCurrency(org.incomeThisMonth ?? 0)
                    ) : (
                      <span className="text-muted-foreground" title="No autorizó compartir montos">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 sm:px-5">
                    {org.shareFinancials && org.incomeTrendPct !== null ? (
                      <span className={org.incomeTrendPct >= 0 ? "text-chip-green" : "text-destructive"}>
                        {org.incomeTrendPct >= 0 ? "+" : ""}
                        {org.incomeTrendPct}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground sm:px-5">{org.daysActive}d</td>
                  <td className="px-3 py-3 sm:px-5">
                    <Badge variant={STATUS_VARIANT[org.status]}>{STATUS_LABEL[org.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
