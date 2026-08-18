"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase.config";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { PasswordField } from "@/components/ui/password-field";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { Envelope1Outlined } from "@lineiconshq/free-icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/dashboard");
    } catch {
      setError("Correo o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-elevated w-full max-w-sm rounded-2xl bg-card p-8">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <HiKontaIcon className="h-14 w-14" />
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

          <PasswordField value={password} onChange={setPassword} required />

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
