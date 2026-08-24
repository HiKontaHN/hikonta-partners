import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Lineicons } from "@lineiconshq/react-lineicons";
import type { LineiconsProps } from "@lineiconshq/react-lineicons";

type IconValue = LineiconsProps["icon"];
import {
  HandShakeOutlined,
  Briefcase1Outlined,
  Rocket5Outlined,
  BarChart4Outlined,
  ArrowRightOutlined,
  Locked1Outlined,
  EyeOutlined,
  ClipboardOutlined,
  SyncOutlined,
  CreditCardMultipleOutlined,
  Share2Outlined,
  ChevronDownOutlined,
} from "@lineiconshq/free-icons";

// Franja de beneficios rápidos — banda de scroll continuo, mismo patrón
// que landing-module-strip.tsx en yelifin-sistema. Repetido varias veces
// (no solo 2x) para que el track siempre tenga contenido de sobra antes
// del reset del loop, incluso en monitores anchos.
const QUICK_BENEFITS: { icon: IconValue; label: string }[] = [
  { icon: EyeOutlined, label: "Seguimiento" },
  { icon: Rocket5Outlined, label: "Impacto" },
  { icon: BarChart4Outlined, label: "Adopción" },
  { icon: Briefcase1Outlined, label: "Portafolio" },
  { icon: ClipboardOutlined, label: "Reportes" },
  { icon: HandShakeOutlined, label: "Patrocinios" },
];
const QUICK_BENEFITS_REPEAT = 8;

// Mismo semáforo verde/amarillo/rojo que STATUS_DOT en el dashboard — ver
// feedback de diseño 2026-08-23 (nada de color decorativo, pero este es el
// estado real del negocio, no decoración).
function StatusDot({ tone }: { tone: "green" | "amber" | "red" }) {
  const cls = tone === "green" ? "bg-chip-green" : tone === "amber" ? "bg-chip-amber" : "bg-destructive";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

// El label va envuelto en su propio <span> (no texto suelto) para que el
// gap del flex aplique de forma confiable entre el punto y la palabra —
// un nodo de texto sin envolver quedaba pegado al punto en algunos casos
// (ver captura 2026-08-23: "Inactivos" pegado al punto rojo).
function StatusBadge({ tone, children }: { tone: "green" | "amber" | "red"; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-foreground">
      <StatusDot tone={tone} />
      <span>{children}</span>
    </span>
  );
}

const HOW_IT_WORKS: { number: string; title: string; description: React.ReactNode }[] = [
  {
    number: "01",
    title: "Centraliza",
    description: "Reúne a todos tus emprendimientos en un solo lugar y consulta su estado al instante.",
  },
  {
    number: "02",
    title: "Observa la evolución",
    description:
      "Monitorea indicadores agregados de ventas, ganancias, clientes, productos, adopción tecnológica y crecimiento por sector.",
  },
  {
    number: "03",
    title: "Detecta y actúa",
    description: (
      <>
        Identifica fácilmente negocios <StatusBadge tone="green">Activos</StatusBadge>,{" "}
        <StatusBadge tone="amber">En riesgo</StatusBadge> o <StatusBadge tone="red">Inactivos</StatusBadge> para
        brindar acompañamiento oportuno.
      </>
    ),
  },
  {
    number: "04",
    title: "Demuestra tu impacto",
    description:
      "Consulta indicadores históricos de tu portafolio y genera información útil para: informes institucionales, patrocinadores, fondos y evaluación de programas.",
  },
];

// Proceso lineal visual de patrocinio — 3 pasos conectados por una flecha
// (horizontal en desktop, apilados en mobile).
const SPONSORSHIP_STEPS: { icon: IconValue; title: string; description: string }[] = [
  { icon: CreditCardMultipleOutlined, title: "Compra", description: "Adquiere meses de acceso." },
  { icon: Share2Outlined, title: "Asigna", description: "Distribúyelos en tu portafolio." },
  { icon: BarChart4Outlined, title: "Mide", description: "Comprueba la adopción y el uso real." },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "¿Qué es HiKonta Partners?",
    a: "Es una plataforma para centralizar seguimiento y medir resultados de programas de apoyo.",
  },
  {
    q: "¿Los emprendedores deben usar HiKonta?",
    a: "Sí, utilizan HiKonta para gestionar sus negocios, lo que alimenta automáticamente tus métricas operativas.",
  },
  {
    q: "¿Puedo ver la información financiera de los negocios?",
    a: "No. Partners prioriza tendencias y variaciones porcentuales para proteger la información sensible.",
  },
  {
    q: "¿Sirve para presentar resultados a patrocinadores?",
    a: "Sí, genera indicadores históricos consolidados ideales para informes institucionales y fondos.",
  },
];

export default function LandingPage() {
  return (
    <main className="bg-background">
      {/* ── Nav ─────────────────────────────────────────────────────── *
       * Fijo arriba de todo — el <main> compensa con pt-16/pt-20 (ver
       * hero de abajo) y las secciones con ancla usan scroll-mt-* para
       * que el header fijo no las tape al saltar desde el nav. */}
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border bg-background/80 backdrop-blur-md sm:h-20">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <HiKontaIcon className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="text-sm font-bold tracking-tight">HiKonta Partners</span>
          </div>

          {/* Centrado — oculto en mobile, no entra junto al resto */}
          <nav className="hidden items-center gap-8 text-sm font-semibold text-muted-foreground md:flex">
            <a href="#como-funciona" className="transition-colors hover:text-foreground">
              ¿Cómo funciona?
            </a>
            <a href="#patrocinios" className="transition-colors hover:text-foreground">
              Patrocinios
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle collapsed />
            <Link
              href="/login"
              className="text-sm font-semibold text-foreground hover:text-primary"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-sm font-bold text-primary-foreground sm:px-5 sm:py-2.5"
            >
              <span className="sm:hidden">Demo</span>
              <span className="hidden sm:inline">Solicitar demo</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-40">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[6fr_5fr] lg:gap-8">
          {/* order-2/1: la imagen queda a la izquierda en desktop, pero el
              <h1> se mantiene primero en el DOM (SEO / lectores de pantalla). */}
          <div className="text-center lg:order-2 lg:text-left">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Convierte los datos de tus emprendedores{" "}
              <span className="text-primary">en decisiones</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0">
              Impulsa a tus emprendedores con la herramienta que necesitan para organizarse. Mide
              su crecimiento y tu impacto en tiempo real.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/register"
                className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
              >
                Solicitar una demo
                <Lineicons icon={ArrowRightOutlined} size={16} />
              </Link>
              <a
                href="#como-funciona"
                className="flex items-center gap-2 rounded-full bg-muted px-6 py-3 text-sm font-bold text-foreground"
              >
                Ver cómo funciona
              </a>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Diseñado para incubadoras, aceleradoras y programas de emprendimiento.
            </p>
          </div>

          <div className="mx-auto w-full max-w-2xl lg:order-1 lg:max-w-none">
            <Image
              src="/hero-image.png"
              alt="Panel de HiKonta Partners: dashboard de portafolio, reportes de adopción y suscripciones"
              width={2000}
              height={1335}
              priority
              className="hero-image-fade h-auto w-full"
            />
          </div>
        </div>
      </section>

      {/* ── Franja de beneficios rápidos ───────────────────────────────
          Loop continuo, se pausa al pasar el mouse. */}
      <section className="overflow-hidden bg-muted py-6">
        <div className="relative mx-auto max-w-6xl">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-muted to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-muted to-transparent" />

          <div
            className="landing-marquee flex w-max items-center gap-10"
            style={{ "--marquee-repeat": QUICK_BENEFITS_REPEAT } as React.CSSProperties}
          >
            {Array.from({ length: QUICK_BENEFITS_REPEAT }, () => QUICK_BENEFITS)
              .flat()
              .map((item, i) => (
                <div
                  key={`${item.label}-${i}`}
                  className="flex min-w-32 shrink-0 items-center justify-center gap-2 text-sm font-bold text-foreground"
                >
                  <Lineicons icon={item.icon} size={18} color="var(--muted-foreground)" />
                  {item.label}
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* ── Sección del problema ───────────────────────────────────────
          Dos columnas en desktop: el planteo del problema a la izquierda,
          la explicación del "cómo" en una card a la derecha. Apiladas y
          centradas en mobile. */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6 sm:pb-24 sm:pt-8">
        <div className="grid grid-cols-1 items-center gap-10 text-center lg:grid-cols-2 lg:gap-16 lg:text-left">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Deja de preguntarte qué impacto tiene tu programa.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0">
              ¿Quién realmente está creciendo? ¿Quién necesita acompañamiento urgente?
            </p>
            <p className="mt-4 text-lg font-bold text-primary sm:text-xl">
              Con HiKonta Partners, conviertes seguimiento en evidencia.
            </p>
          </div>

          <div className="card-elevated flex flex-col items-start gap-4 rounded-xl bg-card p-6 text-left sm:flex-row sm:p-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chip-blue-bg">
              <Lineicons icon={SyncOutlined} size={18} color="var(--chip-blue)" />
            </div>
            <div>
              <h3 className="text-base font-bold sm:text-lg">
                Los datos se generan mientras los emprendedores trabajan.
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
                HiKonta Partners se conecta con la actividad de los emprendimientos que utilizan
                HiKonta. Mientras ellos administran ventas, inventario, clientes y finanzas, tu
                organización obtiene indicadores automáticos de salud y crecimiento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ¿Cómo funciona? ─────────────────────────────────────────── */}
      <section id="como-funciona" className="mx-auto max-w-5xl scroll-mt-20 px-4 pb-16 pt-5 sm:px-6 sm:pb-24 sm:pt-8 sm:scroll-mt-24">
        <h2 className="mb-10 text-center text-2xl font-extrabold tracking-tight">¿Cómo funciona?</h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.number} className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <span className="mb-3 text-3xl font-extrabold text-chip-blue">{step.number}</span>
              <h3 className="text-sm font-bold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>

        {/* Nota de privacidad — parte de esta sección en el doc, no una
            sección aparte. */}
        <div className="card-elevated mt-12 flex flex-col items-start gap-4 rounded-xl bg-card p-6 sm:flex-row">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chip-green-bg">
            <Lineicons icon={Locked1Outlined} size={18} color="var(--chip-green)" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Información útil sin comprometer la privacidad</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Se muestran variaciones porcentuales de desempeño, nunca montos financieros
              sensibles.
            </p>
          </div>
        </div>
      </section>

      {/* ── Patrocinio / Licencias ─────────────────────────────────────
          Proceso lineal visual: 3 pasos conectados por una flecha. */}
      <section id="patrocinios" className="mx-auto max-w-5xl scroll-mt-20 px-4 pb-16 pt-5 sm:px-6 sm:pb-24 sm:pt-8 sm:scroll-mt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            No solo acompañes. <span className="text-primary">Dales las herramientas para crecer.</span>
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Patrocina meses de HiKonta y administra las licencias directamente desde tu panel.
          </p>
        </div>

        <div className="mt-14 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center sm:gap-4">
          {SPONSORSHIP_STEPS.map((step, i) => (
            <div key={step.title} className="flex items-center gap-4 sm:items-start sm:gap-4">
              <div className="flex w-32 flex-col items-center text-center sm:w-36">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-chip-blue-bg">
                  <Lineicons icon={step.icon} size={22} color="var(--chip-blue)" />
                </div>
                <h3 className="mt-4 text-sm font-bold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.description}</p>
              </div>

              {i < SPONSORSHIP_STEPS.length - 1 && (
                <Lineicons
                  icon={ArrowRightOutlined}
                  size={18}
                  color="var(--muted-foreground)"
                  className="mt-5 hidden shrink-0 sm:block"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6 sm:pb-24 sm:pt-8">
        <div className="rounded-2xl bg-primary px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="text-2xl font-extrabold tracking-tight text-primary-foreground sm:text-3xl md:text-4xl">
            El impacto que generas debería poder verse.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-primary-foreground/80 sm:text-lg">
            Centraliza tu portafolio, acompaña mejor a tus emprendimientos y convierte su
            crecimiento en información que tu organización pueda utilizar.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-primary"
            >
              Solicitar una demo
              <Lineicons icon={ArrowRightOutlined} size={16} />
            </Link>
            <a
              href="https://hikonta.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-primary-foreground/30 px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
            >
              Conocer el ecosistema HiKonta
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── *
       * <details>/<summary> nativos — acordeón accesible sin JS extra. */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-16 pt-5 sm:px-6 sm:pb-24 sm:pt-8 sm:scroll-mt-24">
        <h2 className="mb-10 text-center text-2xl font-extrabold tracking-tight">Preguntas frecuentes</h2>
        <div className="flex flex-col gap-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="card-elevated group rounded-xl bg-card p-5 sm:p-6 [&::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold sm:text-base">
                {item.q}
                <Lineicons
                  icon={ChevronDownOutlined}
                  size={16}
                  color="var(--muted-foreground)"
                  className="shrink-0 transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <HiKontaIcon className="h-7 w-7" />
              <span className="text-sm font-bold tracking-tight">HiKonta Partners</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Parte del ecosistema HiKonta — gestión de inventario, ventas y finanzas para
              pequeños negocios.
            </p>
            <a
              href="mailto:hikonta.app@gmail.com"
              className="mt-3 inline-block text-sm font-semibold text-foreground transition-colors hover:text-primary"
            >
              hikonta.app@gmail.com
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-16">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Producto
              </h4>
              <ul className="mt-3 flex flex-col gap-2.5 text-sm font-medium">
                <li>
                  <a href="#como-funciona" className="text-foreground transition-colors hover:text-primary">
                    ¿Cómo funciona?
                  </a>
                </li>
                <li>
                  <a href="#patrocinios" className="text-foreground transition-colors hover:text-primary">
                    Patrocinios
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-foreground transition-colors hover:text-primary">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Cuenta
              </h4>
              <ul className="mt-3 flex flex-col gap-2.5 text-sm font-medium">
                <li>
                  <Link href="/login" className="text-foreground transition-colors hover:text-primary">
                    Iniciar sesión
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="text-foreground transition-colors hover:text-primary">
                    Solicitar demo
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-6xl flex-col-reverse items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} HiKonta Partners. Todos los derechos reservados.</span>
          <a
            href="https://hikonta.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold transition-colors hover:text-foreground"
          >
            hikonta.com
          </a>
        </div>
      </footer>
    </main>
  );
}
