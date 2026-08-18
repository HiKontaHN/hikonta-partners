"use client";

import { useEffect, useState } from "react";
import { User as FirebaseUser, onIdTokenChanged, signOut as fbSignOut } from "firebase/auth";
import { auth } from "@/firebase.config";
import { setTokenCookie, clearTokenCookie } from "@/lib/token-cookie";
import useSWR from "swr";

export type PartnerMe = {
  partnerId: number;
  partnerName: string;
  email: string;
  displayName: string | null;
};

class MeError extends Error {
  status: number;
  reason?: string;
  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

const ME_KEY = "/api/partner/me";

// ⚠️ BYPASS TEMPORAL — ver nota en lib/auth.ts. Con esto activo se salta
// Firebase por completo: token/me quedan fijos, sin pedir login.
const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";
const BYPASS_ME: PartnerMe = {
  partnerId: Number(process.env.NEXT_PUBLIC_BYPASS_PARTNER_ID ?? "1"),
  partnerName: "Partner de prueba",
  email: "dev@hikonta.local",
  displayName: "Modo sin autenticación",
};

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(BYPASS_AUTH ? "bypass" : null);
  const [firebaseLoading, setFirebaseLoading] = useState(!BYPASS_AUTH);

  useEffect(() => {
    if (BYPASS_AUTH) return; // no toca Firebase en modo bypass

    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        setTokenCookie(idToken);
        setToken(idToken);
      } else {
        clearTokenCookie();
        setToken(null);
      }
      setFirebaseLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const { data: me, error: meError, isLoading: meLoading } = useSWR<{ data: PartnerMe }>(
    !BYPASS_AUTH && token ? ME_KEY : null,
    async (url: string) => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new MeError(body?.error ?? "Error al obtener el perfil de partner", res.status, body?.reason);
      }
      return res.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      // Una cuenta pendiente de aprobación (403) no se auto-reintenta —
      // solo cambia cuando el usuario refresca manualmente.
      shouldRetryOnError: (err) => !(err instanceof MeError && err.status === 403),
    }
  );

  async function signOut() {
    if (BYPASS_AUTH) return;
    await fbSignOut(auth);
  }

  // Sesión de Firebase válida, pero sin acceso todavía (partner recién
  // registrado esperando aprobación, o cuenta deshabilitada). Se distingue
  // de "no autenticado" para no mandarlo de vuelta a /login en loop.
  const pending = !BYPASS_AUTH && meError instanceof MeError && meError.status === 403;

  return {
    firebaseUser,
    token,
    me: BYPASS_AUTH ? BYPASS_ME : (me?.data ?? null),
    pending,
    loading: BYPASS_AUTH ? false : firebaseLoading || (!!token && meLoading),
    bypassing: BYPASS_AUTH,
    signOut,
  };
}
