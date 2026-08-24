"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase.config";
import { setTokenCookie } from "@/lib/token-cookie";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { PasswordField } from "@/components/ui/password-field";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  Buildings1Outlined,
  User4Outlined,
  Envelope1Outlined,
  PhoneOutlined,
  HandShakeOutlined,
  ArrowRightOutlined,
} from "@lineiconshq/free-icons";

export default function RegisterPage() {
  const [form, setForm] = useState({
    incubatorName: "",
    contactName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/partner/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body?.error ?? "No se pudo completar el registro");
        return;
      }

      // Registrado — se inicia sesión de una vez. Todavía faltan dos pasos
      // antes del dashboard: verificar el correo (acá) y que un admin
      // apruebe la cuenta (is_active = FALSE — lo maneja el layout del
      // panel con la pantalla de "pendiente" una vez verificado el correo).
      const cred = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      // Mismo fix que app/login/page.tsx: setear la cookie acá antes de
      // navegar (no depender del listener async de useAuth()) y hacer una
      // navegación dura para que proxy.ts vea la cookie ya puesta.
      const idToken = await cred.user.getIdToken();
      setTokenCookie(idToken);

      // Correo con nuestra propia plantilla (lib/mailer.ts), no el de
      // Firebase — la cuenta ya quedó creada, así que un fallo acá no debe
      // bloquear el redirect. El usuario puede reenviarlo desde /verify-email.
      try {
        await fetch("/api/partner/send-verification-email", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
      } catch (mailError) {
        console.error("No se pudo enviar el correo de verificación:", mailError);
      }

      window.location.href = "/verify-email";
    } catch {
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      {/* Mobile: sin "ventana flotante" — el form se funde con la página,
          ancho completo, sin card/sombra/bordes. Desde sm: se convierte en
          card centrada y más ancha (los grids de 2 columnas piden más
          espacio). */}
      <div className="w-full max-w-md sm:max-w-xl sm:rounded-2xl sm:bg-card sm:p-10 sm:shadow-[var(--shadow-card)]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Link href="/">
            <HiKontaIcon className="h-14 w-14" />
          </Link>
          <div>
            <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-chip-blue-bg px-3 py-1 text-xs font-bold text-chip-blue">
              <Lineicons icon={HandShakeOutlined} size={13} />
              Para incubadoras y aceleradoras
            </span>
            <h1 className="text-lg font-extrabold tracking-tight">Registra tu incubadora</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Un coordinador de HiKonta revisa y activa tu acceso
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                <Lineicons icon={Buildings1Outlined} size={16} /> Incubadora
              </span>
              <input
                required
                value={form.incubatorName}
                onChange={(e) => update("incubatorName", e.target.value)}
                placeholder="Aceleradora Terra"
                className="rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                <Lineicons icon={User4Outlined} size={16} /> Contacto
              </span>
              <input
                required
                value={form.contactName}
                onChange={(e) => update("contactName", e.target.value)}
                className="rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                <Lineicons icon={Envelope1Outlined} size={16} /> Correo
              </span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                <Lineicons icon={PhoneOutlined} size={16} /> Teléfono
                <span className="font-normal text-muted-foreground/70">(opcional)</span>
              </span>
              <input
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          <PasswordField
            value={form.password}
            onChange={(v) => update("password", v)}
            required
            minLength={6}
          />

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-60"
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
            )}
            Crear cuenta
            {!loading && <Lineicons icon={ArrowRightOutlined} size={16} />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-primary">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
