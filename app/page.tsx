import Link from "next/link";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Lineicons } from "@lineiconshq/react-lineicons";
import type { LineiconsProps } from "@lineiconshq/react-lineicons";

type IconValue = LineiconsProps["icon"];
import {
  HandShakeOutlined,
  Home2Outlined,
  Briefcase1Outlined,
  Rocket5Outlined,
  BarChart4Outlined,
  ArrowRightOutlined,
  Locked1Outlined,
  DollarCircleOutlined,
} from "@lineiconshq/free-icons";

const FEATURES: { icon: IconValue; title: string; description: string; tone: keyof typeof CHIP }[] = [
  {
    icon: Home2Outlined,
    tone: "blue",
    title: "Resumen ejecutivo",
    description: "Emprendedores totales, activos e inactivos, y tasa de adopción de un vistazo.",
  },
  {
    icon: Briefcase1Outlined,
    tone: "purple",
    title: "Tu portafolio",
    description: "Cada negocio de tu incubadora: plan, ventas del mes y última vez que usó HiKonta.",
  },
  {
    icon: Rocket5Outlined,
    tone: "green",
    title: "Impacto medible",
    description: "Cuánto creció cada negocio desde que se unió a vos — en %, sin necesidad de ver un solo monto.",
  },
  {
    icon: BarChart4Outlined,
    tone: "amber",
    title: "Reporte de adopción",
    description: "El número que le llevas a tu directiva: % de adopción y una recomendación clara.",
  },
];

const CHIP = {
  blue: { fg: "var(--chip-blue)", bg: "var(--chip-blue-bg)" },
  green: { fg: "var(--chip-green)", bg: "var(--chip-green-bg)" },
  amber: { fg: "var(--chip-amber)", bg: "var(--chip-amber-bg)" },
  purple: { fg: "var(--chip-purple)", bg: "var(--chip-purple-bg)" },
} as const;

const STEPS = [
  {
    title: "Vinculamos tu incubadora",
    description: "HiKonta conecta a tus emprendedores con tu cuenta de partner — sin que ellos hagan nada distinto.",
  },
  {
    title: "Monitoreas en tiempo real",
    description: "Ve quién está activo, quién dejó de usar la plataforma, y qué tanto está creciendo cada negocio.",
  },
  {
    title: "Decides con datos",
    description: "Prioriza mentoring donde más se necesita y reporta tracción real a tu directiva.",
  },
];

export default function LandingPage() {
  return (
    <main className="bg-background">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center gap-2">
          <HiKontaIcon className="h-8 w-8 sm:h-9 sm:w-9" />
          <span className="text-sm font-bold tracking-tight">HiKonta Partners</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle collapsed />
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground sm:px-5 sm:py-2.5"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-10 text-center sm:px-6 sm:pb-20 sm:pt-20">
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-chip-purple-bg px-4 py-1.5 text-xs font-bold text-chip-purple">
          <Lineicons icon={HandShakeOutlined} size={14} />
          Para incubadoras y aceleradoras
        </span>

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          La adopción de tu portafolio,{" "}
          <span className="text-primary">en un solo panel</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          HiKonta Partners te muestra qué emprendedores de tu incubadora están usando la
          plataforma, cuáles necesitan un empujón, y cuánta tracción real puedes reportarle a tu
          directiva — sin pedirle un solo reporte a tus emprendedores.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
          >
            Registrar mi incubadora
            <Lineicons icon={ArrowRightOutlined} size={16} />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full bg-muted px-6 py-3 text-sm font-bold text-foreground"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lineicons icon={Locked1Outlined} size={13} />
          Solo lectura — nunca editas datos de tus emprendedores desde aquí
        </p>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const chip = CHIP[f.tone];
            return (
              <div key={f.title} className="card-elevated rounded-xl bg-card p-6">
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: chip.bg }}
                >
                  <Lineicons icon={f.icon} size={20} color={chip.fg} />
                </div>
                <h3 className="text-base font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Cómo funciona ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
        <h2 className="mb-10 text-center text-2xl font-extrabold tracking-tight">Cómo funciona</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-chip-blue-bg text-sm font-extrabold text-chip-blue">
                {i + 1}
              </span>
              <h3 className="text-sm font-bold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Nota de privacidad ──────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="card-elevated flex flex-col items-start gap-4 rounded-xl bg-card p-6 sm:flex-row">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chip-green-bg">
            <Lineicons icon={DollarCircleOutlined} size={18} color="var(--chip-green)" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Los montos son opt-in</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Nunca ves ingresos ni costos de un emprendedor a menos que él mismo lo autorice
              explícitamente. Por defecto solo ves actividad y adopción, no dinero.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
        Parte del ecosistema HiKonta — gestión de inventario, ventas y finanzas para pequeños
        negocios.
      </footer>
    </main>
  );
}
