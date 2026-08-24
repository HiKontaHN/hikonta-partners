"use client";

import { useState } from "react";
import Link from "next/link";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { Locked2Outlined, Envelope1Outlined, ArrowLeftOutlined } from "@lineiconshq/free-icons";

// Pide el correo y dispara /api/partner/send-password-reset — el link de
// verdad lo genera y valida Firebase (ver esa ruta), acá solo mostramos
// la confirmación. La respuesta del backend es siempre la misma exista o
// no la cuenta, así que este componente nunca sabe si el correo existía.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/partner/send-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Demasiados intentos. Espera unos minutos.");
        return;
      }

      // El endpoint responde 200 con el mismo mensaje genérico incluso
      // ante errores internos — no hay un "if (!res.ok)" real que manejar
      // acá aparte del 429 de arriba.
      setSent(true);
    } catch {
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      {/* Mobile: sin "ventana flotante", mismo patrón que /login, /register
          y /verify-email. */}
      <div className="w-full max-w-sm sm:rounded-2xl sm:bg-card sm:p-8 sm:shadow-[var(--shadow-card)]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Link href="/">
            <HiKontaIcon className="h-14 w-14" />
          </Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chip-blue-bg">
            <Lineicons icon={Locked2Outlined} size={22} color="var(--chip-blue)" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Recupera tu contraseña</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Te mandamos un enlace para crear una nueva
            </p>
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Si <span className="font-semibold text-foreground">{email.trim()}</span> está
              registrado, te llega un correo con el enlace en unos minutos. Revisá spam si no lo
              ves.
            </p>
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <Lineicons icon={ArrowLeftOutlined} size={15} />
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                <Lineicons icon={Envelope1Outlined} size={16} /> Correo
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring"
              />
            </label>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-60"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              )}
              Enviar enlace
            </button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Lineicons icon={ArrowLeftOutlined} size={15} />
              Volver a iniciar sesión
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
