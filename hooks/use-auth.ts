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

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [firebaseLoading, setFirebaseLoading] = useState(true);

  useEffect(() => {
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
    token ? ME_KEY : null,
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
    await fbSignOut(auth);
  }

  // Sesión de Firebase válida, pero sin acceso todavía porque el partner
  // espera aprobación (o está deshabilitado) — reason "PENDING_APPROVAL".
  // Se distingue de "no autenticado" para no mandarlo de vuelta a /login
  // en loop, y de "notPartner" de abajo: acá SÍ tiene fila en `partners`,
  // solo que is_active = FALSE.
  const pending =
    meError instanceof MeError && meError.status === 403 && meError.reason === "PENDING_APPROVAL";

  // Cuenta de Firebase válida (ej. un emprendedor de yelifin-sistema —
  // mismo proyecto de Firebase) que nunca se registró como partner acá.
  // No tiene fila en `partners` en absoluto — no es "pendiente", es que
  // esta cuenta no tiene nada que ver con este panel.
  const notPartner =
    meError instanceof MeError && meError.status === 403 && meError.reason === "NOT_PARTNER";

  return {
    firebaseUser,
    token,
    me: me?.data ?? null,
    pending,
    notPartner,
    emailVerified: firebaseUser?.emailVerified ?? false,
    loading: firebaseLoading || (!!token && meLoading),
    signOut,
  };
}
