// proxy.ts — Next.js 16 middleware convention (reemplaza a middleware.ts).
// Versión simplificada de proxy.ts en yelifin-sistema: sin onboarding ni
// reglas de plan, solo protege /(partner)/* detrás de una cookie de sesión
// con un Firebase ID token válido y verificado en Edge.

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

const PUBLIC_PATHS = ["/", "/login", "/register"];

type VerifiedTokenPayload = {
  aud?: string;
  exp?: number;
  email_verified?: boolean;
  [key: string]: any;
};

async function verifyFirebaseToken(
  token: string
): Promise<{ valid: true; payload: VerifiedTokenPayload } | { valid: false }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false };

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
    const payload: VerifiedTokenPayload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
    );

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return { valid: false };
    if (payload.aud !== projectId) return { valid: false };
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return { valid: false };

    // JWK, no PEM/X.509 — el endpoint de certificados x509 (usado antes acá)
    // da un certificado completo, que NO es una estructura SPKI válida:
    // crypto.subtle.importKey("spki", ...) sobre eso fallaba SIEMPRE, para
    // cualquier token, incluso uno legítimo (bug real, confirmado con un
    // token real — quedaba enmascarado por NEXT_PUBLIC_BYPASS_AUTH). Este
    // otro endpoint de Firebase da la misma clave pública pero ya en
    // formato JWK, que Web Crypto sí puede importar directo, sin parsear
    // PEM/DER a mano.
    const keysRes = await fetch(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
      { next: { revalidate: 3600 } }
    );
    if (!keysRes.ok) return { valid: false };

    const { keys } = (await keysRes.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return { valid: false };

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);
    const isValid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, data);
    if (!isValid) return { valid: false };

    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

function base64UrlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

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
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  // "/" es match exacto — con startsWith solo, matchearía cualquier ruta.
  const isPublic = PUBLIC_PATHS.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));

  // Sin cookie o token inválido, DEJAR PASAR (NextResponse.next()), no
  // redirigir duro. verifyFirebaseToken() ya valida de verdad (ver el fix
  // JWK arriba), pero este gate de Edge sigue sin ser la capa de
  // seguridad real — es solo una optimización (evita servir /dashboard
  // sin sesión, redirige a "ya logueado" en /login y /register). Si acá
  // se redirigiera duro a /login ante cualquier fallo (ej. el fetch a
  // Google caído, o un cold start sin la cache de 1h de las keys), un
  // usuario con sesión real quedaría en loop hacia /login. La identidad
  // real — la que de verdad importa — se valida en cada API route vía
  // verifyPartner() (firebase-admin, runtime Node) y en el cliente vía
  // useAuth() + el redirect de app/(partner)/layout.tsx.
  if (!token) return NextResponse.next();

  const result = await verifyFirebaseToken(token);
  if (!result.valid) return NextResponse.next();

  // Token válido + ruta pública (/login, /register) → mandar directo al
  // dashboard.
  if (isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
