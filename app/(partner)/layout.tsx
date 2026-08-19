"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { Lineicons } from "@lineiconshq/react-lineicons";
import {
  Home2Outlined,
  Briefcase1Outlined,
  BarChart4Outlined,
  Crown3Outlined,
  ExitOutlined,
  MenuHamburger1Outlined,
  XmarkOutlined,
  HourglassOutlined,
  ChevronLeftOutlined,
} from "@lineiconshq/free-icons";

// "Actividad" (feed de eventos) se sacó del panel — quedaba redundante con
// el detalle de organización, que ya muestra la misma información como
// tendencia % (ver ImpactBanner en organizations/[id]/page.tsx).
const NAV = [
  { href: "/dashboard", label: "Resumen", icon: Home2Outlined },
  { href: "/organizations", label: "Emprendedores", icon: Briefcase1Outlined },
  { href: "/subscriptions", label: "Suscripciones", icon: Crown3Outlined },
  { href: "/reports", label: "Reportes", icon: BarChart4Outlined },
];

const SIDEBAR_COLLAPSED_KEY = "hikonta-partners:sidebar-collapsed";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, pending, bypassing, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restaura el estado colapsado guardado (después del mount, para no
  // pelear con la pantalla de carga que se renderiza primero siempre).
  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    // "pending" es sesión válida sin acceso todavía — no es "sin sesión",
    // así que NO se manda a /login (evitaría un loop /login ↔ /dashboard).
    if (!loading && !me && !pending) router.replace("/login");
  }, [loading, me, pending, router]);

  // Cierra el drawer al cambiar de ruta (mobile)
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  if (pending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-chip-amber-bg">
          <Lineicons icon={HourglassOutlined} size={26} color="var(--chip-amber)" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Cuenta pendiente de aprobación</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Ya registraste tu incubadora. El equipo de HiKonta necesita aprobar tu acceso y
            vincular tus organizaciones antes de que veas datos aquí — te avisamos por correo.
          </p>
        </div>
        <button
          onClick={() => signOut()}
          className="mt-2 flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
        >
          <Lineicons icon={ExitOutlined} size={16} />
          Cerrar sesión
        </button>
      </div>
    );
  }

  if (!me) return null; // redirigiendo a /login

  // TS no arrastra el narrowing de `me` hacia las funciones anidadas de
  // abajo (aunque se ejecutan en el mismo render) — se recaptura acá.
  const partner = me;
  const currentLabel = NAV.find((item) => pathname.startsWith(item.href))?.label ?? "";

  // ── Nav — con tooltip flotante propio cuando está colapsado ──────────
  function renderNav(collapsedMode: boolean) {
    return (
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group/navitem relative flex items-center gap-3 rounded-full py-2.5 text-sm font-semibold transition-colors",
                collapsedMode ? "justify-center px-0" : "px-4",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Lineicons icon={item.icon} size={18} />
              {!collapsedMode && item.label}
              {collapsedMode && (
                <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background opacity-0 shadow-lg transition-opacity group-hover/navitem:opacity-100">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  // ── Cuerpo del sidebar — mismo contenido para la isla de desktop y el
  // drawer de mobile; `collapsedMode` solo se activa en desktop.
  function renderSidebarBody(collapsedMode: boolean, showToggle: boolean) {
    return (
      <>
        <div>
          <div
            className={cn(
              "mb-8 flex pt-1",
              collapsedMode ? "flex-col items-center gap-2" : "items-center justify-between gap-2 px-2"
            )}
          >
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <HiKontaIcon className="h-9 w-9 shrink-0" />
              {!collapsedMode && (
                <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
                  HiKonta Partners
                </span>
              )}
            </Link>

            {showToggle && (
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                aria-label={collapsedMode ? "Expandir menú" : "Contraer menú"}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Lineicons
                  icon={ChevronLeftOutlined}
                  size={14}
                  className={cn("transition-transform", collapsedMode && "rotate-180")}
                />
              </button>
            )}
          </div>

          {renderNav(collapsedMode)}
        </div>

        <div
          className={cn(
            "card-elevated flex flex-col gap-3 rounded-xl bg-card",
            collapsedMode ? "items-center p-2" : "p-4"
          )}
        >
          {!collapsedMode && (
            <div className="w-full text-xs">
              <p className="truncate font-bold text-foreground">{partner.partnerName}</p>
              <p className="truncate text-muted-foreground">{partner.email}</p>
            </div>
          )}
          <button
            onClick={() => signOut()}
            aria-label="Cerrar sesión"
            title={collapsedMode ? "Cerrar sesión" : undefined}
            className={cn(
              "flex items-center justify-center gap-2 rounded-full bg-muted text-sm font-semibold text-foreground transition-colors hover:bg-secondary",
              collapsedMode ? "h-9 w-9 shrink-0" : "w-full px-4 py-2"
            )}
          >
            <Lineicons icon={ExitOutlined} size={16} />
            {!collapsedMode && "Cerrar sesión"}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* ── Sidebar desktop: isla flotante, colapsable a rail de íconos ── */}
      <aside
        className={cn(
          "hidden shrink-0 p-3 transition-[width] duration-200 ease-linear md:block",
          collapsed ? "w-[88px]" : "w-64"
        )}
      >
        <div className="card-elevated flex h-full flex-col justify-between rounded-2xl bg-sidebar p-3">
          {renderSidebarBody(collapsed, true)}
        </div>
      </aside>

      {/* ── Sidebar mobile: drawer off-canvas, siempre expandido ────────── */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col justify-between bg-sidebar p-4 shadow-2xl transition-transform duration-200 ease-out md:hidden",
          navOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {renderSidebarBody(false, false)}
      </aside>

      {/* Columna derecha: navbar + banner quedan fijos (shrink-0, fuera del
          scroll); solo <main> hace scroll — igual mecanismo que ya fija el
          sidebar (contenedor raíz h-svh + overflow-hidden). */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 md:pl-0">
        {/* ── Navbar: isla flotante igual que el sidebar — rounded-2xl +
            sombra, sin borde. Hamburguesa+logo en mobile, título de página
            en desktop; el toggle de modo oscuro vive acá, no en el sidebar ── */}
        <header className="card-elevated flex shrink-0 items-center gap-3 rounded-2xl bg-card px-4 py-3">
          <button
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Abrir menú"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted md:hidden"
          >
            <Lineicons icon={navOpen ? XmarkOutlined : MenuHamburger1Outlined} size={18} />
          </button>
          <div className="flex items-center gap-2 md:hidden">
            <HiKontaIcon className="h-7 w-7" />
            <span className="text-sm font-bold tracking-tight">HiKonta Partners</span>
          </div>

          <h1 className="hidden text-base font-bold tracking-tight md:block">{currentLabel}</h1>

          <div className="ml-auto">
            <ThemeToggle collapsed />
          </div>
        </header>

        {bypassing && (
          <div className="mt-3 shrink-0 rounded-2xl bg-warning px-4 py-2 text-center text-xs font-bold text-warning-foreground">
            ⚠️ Modo sin autenticación — el login está bypaseado (NEXT_PUBLIC_BYPASS_AUTH)
          </div>
        )}

        <main className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-auto">
          <div className="mx-auto max-w-6xl pb-3">{children}</div>
        </main>
      </div>
    </div>
  );
}
