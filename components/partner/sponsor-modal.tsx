"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Plan = { id: number; name: string; priceUsd: number; billingInterval: string };
type PlansResponse = { data: Plan[] };

const INPUT_CLASS =
  "rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring";

export function SponsorModal({
  open,
  onClose,
  onSuccess,
  orgId,
  orgName,
  currentPlanId,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: number;
  orgName: string;
  currentPlanId: number | null;
}) {
  const { token } = useAuth();
  const { data: plansData } = usePartnerSWR<PlansResponse>(open ? "/api/partner/plans" : null);

  const [months, setMonths] = useState("1");
  const [planId, setPlanId] = useState<string>("");
  const [amountUsd, setAmountUsd] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setMonths("1");
    setPlanId("");
    setAmountUsd("0");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const monthsPurchased = Number(months);
    if (!Number.isInteger(monthsPurchased) || monthsPurchased <= 0) {
      setError("Ingresa un número entero de meses mayor a 0");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/partner/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orgId,
          monthsPurchased,
          amountUsd: Number(amountUsd) || 0,
          ...(planId && { planId: Number(planId) }),
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body?.error ?? "No se pudo registrar el patrocinio");
        return;
      }

      reset();
      onSuccess();
      onClose();
    } catch {
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Patrocinar meses — ${orgName}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-muted-foreground">Meses a patrocinar</span>
          <input
            type="number"
            min={1}
            step={1}
            required
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-muted-foreground">Plan (opcional)</span>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Mantener el plan actual</option>
            {plansData?.data.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — ${plan.priceUsd}/{plan.billingInterval === "YEARLY" ? "año" : "mes"}
                {plan.id === currentPlanId ? " (actual)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-muted-foreground">Monto (USD, opcional)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amountUsd}
            onChange={(e) => setAmountUsd(e.target.value)}
            className={INPUT_CLASS}
          />
          <span className="px-1 text-xs text-muted-foreground">
            Déjalo en 0 si el patrocinio es gratuito para el emprendedor — solo queda como registro contable.
          </span>
        </label>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
            )}
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
