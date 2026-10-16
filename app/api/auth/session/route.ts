import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { sql } from "@/lib/db";
import { hasValidRequestOrigin } from "@/lib/request-origin";

const SESSION_COOKIE = "hikonta_partner_auth";
const SESSION_MAX_AGE = 60 * 60 * 24 * 5;

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  // Retira la cookie legada que contenía el ID token y era legible por JS.
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Sesión ausente" }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie);
    const user = await adminAuth.getUser(decoded.uid);
    if (user.disabled) {
      return NextResponse.json({ error: "Cuenta deshabilitada" }, { status: 401 });
    }

    return NextResponse.json({
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      emailVerified: user.emailVerified,
      sessionEmailVerified: decoded.email_verified === true,
    });
  } catch {
    const response = NextResponse.json(
      { error: "Sesión inválida o expirada" },
      { status: 401 },
    );
    clearSessionCookie(response);
    return response;
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Origen no autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const idToken = body?.idToken;
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    // Un token renovado silenciosamente no puede extender indefinidamente
    // una sesión: solo aceptamos una autenticación interactiva reciente.
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      return NextResponse.json(
        { error: "Inicia sesión nuevamente para crear una sesión" },
        { status: 401 },
      );
    }

    const [account] = await sql`
      SELECT u.is_active AS user_is_active, p.id AS partner_id
      FROM users u
      LEFT JOIN partners p ON p.user_id = u.id
      WHERE u.firebase_uid = ${decoded.uid}
      LIMIT 1
    `;

    if (!account?.partner_id) {
      return NextResponse.json(
        {
          error: "Esta cuenta no tiene acceso al panel de partners",
          reason: "NOT_PARTNER",
        },
        { status: 403 },
      );
    }
    if (!account.user_is_active) {
      return NextResponse.json({ error: "Cuenta deshabilitada" }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE * 1000,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    response.cookies.set("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Token inválido o expirado" },
      { status: 401 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Origen no autorizado" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}

