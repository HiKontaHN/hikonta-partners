"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, authReady } from "@/firebase.config";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { PasswordField } from "@/components/ui/password-field";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  Buildings1Outlined,
  User4Outlined,
  Envelope1Outlined,
  PhoneOutlined,
  HandShakeOutlined,
  ArrowRightOutlined,
} from "@lineiconshq/free-icons";

const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL ?? "https://hikonta.app";
const BIRTH_MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
].map((label, index) => ({ value: String(index + 1), label }));
const BIRTH_DAYS = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));
const MAX_BIRTH_YEAR = new Date().getUTCFullYear() - 18;
const BIRTH_YEARS = Array.from({ length: 100 }, (_, index) => {
  const year = String(MAX_BIRTH_YEAR - index);
  return { value: year, label: year };
});

function dateOfBirthFromParts(month: string, day: string, year: string) {
  if (!/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day) || !/^\d{4}$/.test(year)) {
    return null;
  }

  const normalizedMonth = month.padStart(2, "0");
  const normalizedDay = day.padStart(2, "0");
  const dateOfBirth = `${year}-${normalizedMonth}-${normalizedDay}`;
  const parsed = new Date(`${dateOfBirth}T00:00:00Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== dateOfBirth
  ) {
    return null;
  }

  return dateOfBirth;
}

function isAdult(dateOfBirth: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return false;

  const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.toISOString().slice(0, 10) !== dateOfBirth
  ) {
    return false;
  }

  const today = new Date();
  if (birthDate > today) return false;

  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayPending =
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() &&
      today.getUTCDate() < birthDate.getUTCDate());
  if (birthdayPending) age -= 1;

  return age >= 18;
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    incubatorName: "",
    contactName: "",
    email: "",
    phone: "",
    birthMonth: "",
    birthDay: "",
    birthYear: "",
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

    const dateOfBirth = dateOfBirthFromParts(
      form.birthMonth,
      form.birthDay,
      form.birthYear,
    );
    if (!dateOfBirth || !isAdult(dateOfBirth)) {
      setError("Debes ingresar una fecha válida y tener al menos 18 años para crear una cuenta");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/partner/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incubatorName: form.incubatorName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          dateOfBirth,
        }),
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
      await authReady;
      const cred = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      const idToken = await cred.user.getIdToken();
      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!sessionResponse.ok) {
        throw new Error("No se pudo iniciar la sesión");
      }
      await signOut(auth);

      // Correo con nuestra propia plantilla (lib/mailer.ts), no el de
      // Firebase — la cuenta ya quedó creada, así que un fallo acá no debe
      // bloquear el redirect. El usuario puede reenviarlo desde /verify-email.
      try {
        await fetch("/api/partner/send-verification-email", {
          method: "POST",
        });
      } catch (mailError) {
        console.error("No se pudo enviar el correo de verificación:", mailError);
      }

      window.location.href = "/verify-email";
    } catch {
      await signOut(auth).catch(() => undefined);
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

          <fieldset className="flex flex-col gap-1.5 text-sm">
            <legend className="font-semibold text-muted-foreground">Fecha de nacimiento</legend>
            <div className="grid grid-cols-[1fr_1fr_1.35fr] gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Mes</span>
                <SearchableSelect
                  id="birth-month"
                  value={form.birthMonth}
                  options={BIRTH_MONTHS}
                  onChange={(value) => update("birthMonth", value)}
                  placeholder="Mes"
                  searchPlaceholder="Buscar mes..."
                  disabled={loading}
                  className="h-11 w-full"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Día</span>
                <SearchableSelect
                  id="birth-day"
                  value={form.birthDay}
                  options={BIRTH_DAYS}
                  onChange={(value) => update("birthDay", value)}
                  placeholder="Día"
                  searchPlaceholder="Buscar día..."
                  disabled={loading}
                  className="h-11 w-full"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Año</span>
                <SearchableSelect
                  id="birth-year"
                  value={form.birthYear}
                  options={BIRTH_YEARS}
                  onChange={(value) => update("birthYear", value)}
                  placeholder="Año"
                  searchPlaceholder="Buscar año..."
                  align="end"
                  disabled={loading}
                  className="h-11 w-full"
                />
              </label>
            </div>
            <span className="text-xs text-muted-foreground">
              Se usa únicamente para comprobar elegibilidad y no se conserva.
            </span>
          </fieldset>

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

          <p className="text-center text-xs text-muted-foreground">
            Al crear una cuenta, aceptas nuestros{" "}
            <Link href={`${MAIN_APP_URL}/terms`} className="underline hover:text-primary">
              términos de servicio
            </Link>{" "}
            y{" "}
            <Link href={`${MAIN_APP_URL}/privacy`} className="underline hover:text-primary">
              política de privacidad
            </Link>
            .
          </p>
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
