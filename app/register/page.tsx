"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase.config";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { PasswordField } from "@/components/ui/password-field";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { Buildings1Outlined, User4Outlined, Envelope1Outlined } from "@lineiconshq/free-icons";

export default function RegisterPage() {
  const router = useRouter();
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

      // Registrado — se inicia sesión de una vez. La cuenta queda pendiente
      // de aprobación (is_active = FALSE), así que el layout del panel va a
      // mostrar la pantalla de "pendiente" en vez del dashboard.
      await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      router.push("/dashboard");
    } catch {
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="card-elevated w-full max-w-sm rounded-2xl bg-card p-8">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <HiKontaIcon className="h-14 w-14" />
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Registra tu incubadora</h1>
            <p className="text-sm text-muted-foreground">
              Un coordinador de HiKonta revisa y activa tu acceso
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
              <Lineicons icon={Buildings1Outlined} size={16} /> Nombre de la incubadora
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
              <Lineicons icon={User4Outlined} size={16} /> Nombre de contacto
            </span>
            <input
              required
              value={form.contactName}
              onChange={(e) => update("contactName", e.target.value)}
              className="rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring"
            />
          </label>

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
            <span className="font-semibold text-muted-foreground">Teléfono (opcional)</span>
            <input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="rounded-full border-0 bg-muted px-4 py-2.5 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring"
            />
          </label>

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
