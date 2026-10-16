// proxy.ts — Next.js 16 middleware convention (reemplaza a middleware.ts).
// Versión simplificada de proxy.ts en yelifin-sistema: sin onboarding ni
// reglas de plan, protege las páginas con una cookie de sesión Firebase.

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { adminAuth } from "@/lib/firebase-admin";

const PUBLIC_PATHS = ["/", "/login", "/register"];

const SESSION_COOKIE = "hikonta_partner_auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Rate limit global para toda la API ─────────────────────────────
  // Portado de proxy.ts en hikonta-admin (que a su vez lo tomó de
  // yelifin-sistema): 300 solicitudes por minuto por IP, antes de que la
  // request llegue a ninguna route (que hace su propia verifyPartner()
  // aparte, esto no la reemplaza). Endpoints puntuales especialmente
  // sensibles (ej. registro público de partner) tienen además su propio
  // límite más estricto dentro del route handler — ver lib/rate-limit.ts.
  if (pathname.startsWith("/api")) {
    const { allowed, retryAfterSec } = rateLimit(
      `api:${getClientIP(request)}`,
      300,
      60 * 1000,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá de nuevo en unos segundos." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      );
    }
    const response = NextResponse.next();
    if (request.cookies.has("token")) {
      response.cookies.set("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    return response;
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  // "/" es match exacto — con startsWith solo, matchearía cualquier ruta.
  const isPublic = PUBLIC_PATHS.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));

  if (!sessionCookie) return NextResponse.next();

  try {
    await adminAuth.verifySessionCookie(sessionCookie);
  } catch {
    const response = isPublic
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(SESSION_COOKIE);
    response.cookies.delete("token");
    return response;
  }

  // Sesión válida + ruta pública (/login, /register) → mandar directo al
  // dashboard.
  if (isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
