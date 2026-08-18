"use client";

import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { Card } from "@/components/ui/card";

type ActivityRow = { orgId: number; orgName: string; action: string; occurredAt: string };
type ActivityResponse = { data: ActivityRow[] };

export default function ActivityPage() {
  const { data, isLoading } = usePartnerSWR<ActivityResponse>("/api/partner/activity");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Actividad reciente</h1>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {data && data.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin actividad registrada todavía.</p>
      )}

      <div className="flex flex-col gap-2">
        {data?.data.map((a, i) => (
          <Card key={i} className="p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                <span className="font-bold">{a.orgName}</span>{" "}
                <span className="text-muted-foreground">— {a.action.toLowerCase()}</span>
              </p>
              <span className="text-xs font-medium text-muted-foreground">
                {new Date(a.occurredAt).toLocaleString("es-HN")}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
