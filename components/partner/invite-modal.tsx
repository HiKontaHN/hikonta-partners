"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePartnerSWR } from "@/hooks/use-partner-swr";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateShort } from "@/lib/utils";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { XmarkOutlined } from "@lineiconshq/free-icons";

// Registro nuevo apunta acá con ?ref=CODIGO — el propio código sirve
// también como "código para usuario ya existente" (Configuración >
// Organización en yelifin-sistema). Un solo mecanismo para los dos casos
// que describió el partner, ver database/partners/04-invite-codes.sql.
const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL ?? "https://hikonta.app";

type InviteCode = {
  id: number;
  code: string;
  status: "ACTIVE" | "USED" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  usedAt: string | null;
  usedByOrgId: number | null;
  usedByOrgName: string | null;
  createdAt: string;
};

type InvitesResponse = { data: InviteCode[] };

const STATUS_LABEL: Record<InviteCode["status"], string> = {
  ACTIVE: "Activo",
  USED: "Usado",
  EXPIRED: "Expirado",
  REVOKED: "Cancelado",
};

const STATUS_VARIANT: Record<InviteCode["status"], "success" | "warning" | "muted" | "danger"> = {
  ACTIVE: "success",
  USED: "muted",
  EXPIRED: "warning",
  REVOKED: "danger",
};

function registerLink(code: string) {
  return `${MAIN_APP_URL}/register?ref=${code}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard bloqueado (permiso/http sin TLS) — no hay mucho más que
      // hacer que dejar al usuario copiar a mano el texto ya visible.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/70"
    >
      {copied ? "Copiado ✓" : "Copiar"}
    </button>
  );
}

export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token } = useAuth();
  const { data, isLoading, mutate } = usePartnerSWR<InvitesResponse>(open ? "/api/partner/invites" : null);
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/partner/invites", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo generar el código");
        return;
      }
      await mutate();
    } catch {
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: number) {
    setError(null);
    setRevokingId(id);
    try {
      const res = await fetch(`/api/partner/invites/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "No se pudo cancelar el código");
        return;
      }
      await mutate();
    } catch {
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setRevokingId(null);
    }
  }

  const codes = data?.data ?? [];
  const newest = codes[0];
  const newestIsFresh = newest?.status === "ACTIVE" && !newest.usedAt;

  return (
    <Modal open={open} onClose={onClose} title="Agregar organización" maxWidthClassName="max-w-md">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Generá un código para sumar un emprendedor a tu portafolio. Compartí el <strong>enlace</strong> si
          todavía no tiene cuenta en HiKonta, o el <strong>código</strong> a solas si ya la tiene — lo ingresa
          en Configuración → Organización. El vínculo siempre lo confirma el emprendedor, nunca se agrega solo.
        </p>

        <Button type="button" onClick={handleGenerate} disabled={generating}>
          {generating && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
          )}
          Generar nuevo código
        </Button>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        {newestIsFresh && (
          <div className="flex flex-col gap-2 rounded-2xl bg-muted p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Código</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold tracking-wider">{newest.code}</span>
                <CopyButton text={newest.code} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Enlace de registro</span>
              <CopyButton text={registerLink(newest.code)} />
            </div>
            <p className="truncate text-xs text-muted-foreground">{registerLink(newest.code)}</p>
            <p className="text-xs text-muted-foreground">Vence {formatDateShort(newest.expiresAt)}</p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-muted-foreground">Códigos generados</p>
          {isLoading ? (
            <p className="py-3 text-sm text-muted-foreground">Cargando…</p>
          ) : codes.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Todavía no generaste ningún código.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-t border-border first:border-0">
                      <td className="py-2 pr-2 font-mono font-semibold">{c.code}</td>
                      <td className="py-2 pr-2">
                        <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {c.usedByOrgName ?? (c.status === "ACTIVE" ? `Vence ${formatDateShort(c.expiresAt)}` : "—")}
                      </td>
                      <td className="py-2 text-right">
                        {c.status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(c.id)}
                            disabled={revokingId === c.id}
                            aria-label="Cancelar código"
                            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                          >
                            <Lineicons icon={XmarkOutlined} size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-2 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
