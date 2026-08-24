"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { setTokenCookie } from "@/lib/token-cookie";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { Spinner } from "@/components/ui/spinner";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { Envelope1Outlined, SyncOutlined, ExitOutlined } from "@lineiconshq/free-icons";

const RESEND_COOLDOWN = 60;

// Paso intermedio entre registrarse y ver el panel — igual patrón que
// app/(auth)/verify-email/page.tsx en yelifin-sistema: Firebase sigue
// generando y validando el link de verificación, esto solo espera a que
// el usuario lo use y refresca la sesión cuando confirma. El siguiente
// paso (aprobación del admin) lo maneja PartnerLayout con la pantalla de
// "pendiente" — acá no hace falta saber nada de eso.
export default function VerifyEmailPage() {
  const { firebaseUser, loading, emailVerified, signOut } = useAuth();
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (emailVerified) {
      router.replace("/dashboard");
    }
  }, [firebaseUser, loading, emailVerified, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    if (!firebaseUser || cooldown > 0) return;
    setMessage(null);
    setIsSending(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/partner/send-verification-email", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: body?.error ?? "Demasiados intentos. Esperá unos minutos." });
        return;
      }
      if (!res.ok) throw new Error("send-verification-email failed");

      setMessage({ type: "success", text: "Correo enviado. Revisá tu bandeja de entrada." });
      setCooldown(RESEND_COOLDOWN);
    } catch {
      setMessage({ type: "error", text: "Error al enviar el correo. Intenta de nuevo." });
    } finally {
      setIsSending(false);
    }
  }

  async function handleCheckVerification() {
    if (!firebaseUser) return;
    setMessage(null);
    setIsChecking(true);
    try {
      await firebaseUser.reload();
      if (firebaseUser.emailVerified) {
        // Refrescar el token para que la cookie lleve email_verified=true;
        // si no, el próximo request al panel puede leer el token viejo.
        const freshToken = await firebaseUser.getIdToken(true);
        setTokenCookie(freshToken);
        router.replace("/dashboard");
      } else {
        setMessage({ type: "error", text: "Tu correo todavía no está verificado." });
      }
    } catch {
      setMessage({ type: "error", text: "Error al verificar. Intenta de nuevo." });
    } finally {
      setIsChecking(false);
    }
  }

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      {/* Mobile: sin "ventana flotante", igual que /login y /register. */}
      <div className="w-full max-w-md sm:rounded-2xl sm:bg-card sm:p-8 sm:shadow-[var(--shadow-card)]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Link href="/">
            <HiKontaIcon className="h-14 w-14" />
          </Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chip-blue-bg">
            <Lineicons icon={Envelope1Outlined} size={22} color="var(--chip-blue)" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Verifica tu correo</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Te enviamos un correo de verificación a{" "}
              <span className="font-semibold text-foreground">{firebaseUser.email}</span>. Revisá
              tu bandeja de entrada (y spam) y hacé clic en el enlace para activar tu cuenta.
            </p>
          </div>
        </div>

        {message && (
          <p
            className={`mb-4 text-center text-sm font-medium ${
              message.type === "error" ? "text-destructive" : "text-chip-green"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleCheckVerification}
            disabled={isChecking}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-60"
          >
            {isChecking && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
            )}
            Ya verifiqué mi correo
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={isSending || cooldown > 0}
            className="flex items-center justify-center gap-2 rounded-full bg-muted px-4 py-3 text-sm font-semibold text-foreground transition-opacity hover:bg-secondary disabled:opacity-60"
          >
            <Lineicons icon={SyncOutlined} size={15} className={isSending ? "animate-spin" : undefined} />
            {isSending ? "Enviando…" : cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar correo de verificación"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 flex w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Lineicons icon={ExitOutlined} size={15} />
          Cerrar sesión y usar otra cuenta
        </button>
      </div>
    </main>
  );
}
