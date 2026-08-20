"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Spinner, SectionSpinner } from "@/components/ui/spinner";

// Un lote (batch) de créditos de suscripción — ver GET /api/partner/credits.
// El patrocinio SOLO puede salir de acá: HiKonta ya cobró el lote completo
// por adelantado (ver hikonta-admin/documentation/
// feature-sponsorship-invites.md), así que ya no hay campo de monto/plan
// libre — eso permitía "inventar" un patrocinio sin ningún cargo real
// detrás. Cada crédito asignado es una de las N plazas ya pagas del lote.
type CreditBatchRow = {
  id: number;
  plan_name: string;
  months: number;
  pending_count: number;
};

type CreditsResponse = { data: CreditBatchRow[] };

const INPUT_CLASS =
  "rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring";

export function SponsorModal({
  open,
  onClose,
  onSuccess,
  orgId,
  orgName,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: number;
  orgName: string;
}) {
  const { token } = useAuth();
  const { data: creditsData, isLoading: creditsLoading } = usePartnerSWR<CreditsResponse>(
    open ? "/api/partner/credits" : null
  );
  const availableBatches = (creditsData?.data ?? []).filter((b) => b.pending_count > 0);

  const [batchId, setBatchId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Preselecciona el primer lote disponible apenas carga — la mayoría de
  // las veces el partner solo tiene uno.
  useEffect(() => {
    if (!batchId && availableBatches.length > 0) setBatchId(String(availableBatches[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableBatches.length]);

  function reset() {
    setBatchId("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!batchId) {
      setError("Elegí un lote de créditos");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/partner/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orgId, batchId: Number(batchId) }),
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
      {creditsLoading ? (
        <SectionSpinner className="py-6" />
      ) : availableBatches.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            No tenés créditos de suscripción disponibles para patrocinar. Un lote lo factura HiKonta
            por adelantado — mirá la sección "Créditos de suscripción" en Suscripciones. Cuando
            tengas un lote con plazas pendientes, vas a poder asignarlas acá.
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Entendido
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-muted-foreground">Crédito a usar</span>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className={INPUT_CLASS}
              required
            >
              <option value="" disabled>
                Elegí un lote…
              </option>
              {availableBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.plan_name} — {b.months} mes{b.months === 1 ? "" : "es"} ({b.pending_count} disponible
                  {b.pending_count === 1 ? "" : "s"})
                </option>
              ))}
            </select>
            <span className="px-1 text-xs text-muted-foreground">
              Ya está pago — asignarlo no genera un cobro nuevo, solo extiende el plan de esta
              organización.
            </span>
          </label>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner size={16} className="border-primary-foreground/40 border-t-primary-foreground" />}
              Confirmar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
