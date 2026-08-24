"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/firebase.config";
import { setTokenCookie } from "@/lib/token-cookie";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { PasswordField } from "@/components/ui/password-field";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { Envelope1Outlined } from "@lineiconshq/free-icons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();

      // Firebase es el mismo proyecto que yelifin-sistema — una cuenta de
      // emprendedor puede autenticarse acá perfectamente bien y no tiene
      // NADA que ver con este panel. Se corta antes de dejarla "entrar":
      // si /me da 403 NOT_PARTNER (sin fila en `partners`, ni siquiera
      // pendiente de aprobación), se cierra la sesión recién abierta y se
      // muestra el error en el propio form, en vez de dejarla ver
      // cualquier pantalla del lado de /dashboard.
      const meRes = await fetch("/api/partner/me", { headers: { Authorization: `Bearer ${idToken}` } });
      if (meRes.status === 403) {
        const body = await meRes.json().catch(() => ({}));
        if (body?.reason === "NOT_PARTNER") {
          await signOut(auth);
          setError("Esta cuenta no tiene acceso al panel de partners.");
          return;
        }
        // reason === "PENDING_APPROVAL": SÍ es partner, solo falta la
        // aprobación — sigue de largo, el layout muestra esa pantalla.
      }

      // proxy.ts (middleware) valida la cookie `token`, no el estado de
      // Firebase en el cliente — hay que setearla ACÁ antes de navegar. Si
      // se deja que la setee el listener onIdTokenChanged de useAuth() (que
      // dispara async, después de esta función), router.push llega primero:
      // el middleware no encuentra cookie y rebota de vuelta a /login.
      setTokenCookie(idToken);
      // Navegación dura, no router.push(). El router cache del cliente puede
      // haber guardado una respuesta previa de /dashboard (redirigida a
      // /login por el middleware, de antes de tener cookie) y servirla de
      // nuevo sin volver a pasar por proxy.ts. Un reload completo garantiza
      // una petición fresca con la cookie ya seteada.
      window.location.href = "/dashboard";
    } catch {
      setError("Correo o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      {/* Mobile: sin "ventana flotante" — se funde con la página, ancho
          completo, sin card/sombra/bordes. Desde sm: se convierte en card
          centrada (mismo patrón que /register y /verify-email). */}
      <div className="w-full max-w-sm sm:rounded-2xl sm:bg-card sm:p-8 sm:shadow-[var(--shadow-card)]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Link href="/">
            <HiKontaIcon className="h-14 w-14" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Panel de Partners</h1>
            <p className="text-sm text-muted-foreground">Acceso para incubadoras y aceleradoras</p>
          </div>
        </div>

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

          <div className="flex flex-col gap-1.5">
            <PasswordField value={password} onChange={setPassword} required />
            <Link href="/forgot-password" className="self-end text-xs font-semibold text-primary">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-60"
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
            )}
            Iniciar sesión
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Tu incubadora todavía no tiene cuenta?{" "}
          <Link href="/register" className="font-semibold text-primary">
            Regístrala
          </Link>
        </p>
      </div>
    </main>
  );
}
