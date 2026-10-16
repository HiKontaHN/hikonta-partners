"use client";

import { useCallback } from "react";
import { signOut as firebaseSignOut } from "firebase/auth";
import useSWR from "swr";
import { auth } from "@/firebase.config";

export type PartnerMe = {
  partnerId: number;
  partnerName: string;
  email: string;
  displayName: string | null;
};

export type SessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  sessionEmailVerified: boolean;
};

class AuthError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

const SESSION_KEY = "/api/auth/session";
const ME_KEY = "/api/partner/me";

async function fetchSession(url: string): Promise<SessionUser | null> {
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("No se pudo validar la sesión");
  return response.json();
}

async function fetchMe(url: string): Promise<{ data: PartnerMe }> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new AuthError(
      body?.error ?? "Error al obtener el perfil de partner",
      response.status,
      body?.reason,
    );
  }
  return response.json();
}

export function useAuth() {
  const {
    data: session,
    error: sessionError,
    isLoading: sessionLoading,
    mutate: mutateSession,
  } = useSWR<SessionUser | null>(SESSION_KEY, fetchSession, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
  });

  const {
    data: me,
    error: meError,
    isLoading: meLoading,
    mutate: mutateMe,
  } = useSWR<{ data: PartnerMe }>(session ? ME_KEY : null, fetchMe, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
    shouldRetryOnError: (error) =>
      !(error instanceof AuthError && [401, 403].includes(error.status)),
  });

  const signOut = useCallback(async () => {
    const response = await fetch(SESSION_KEY, { method: "DELETE" });
    if (!response.ok) throw new Error("No se pudo cerrar la sesión");
    await firebaseSignOut(auth).catch(() => undefined);
    await Promise.all([
      mutateSession(null, { revalidate: false }),
      mutateMe(undefined, { revalidate: false }),
    ]);
  }, [mutateMe, mutateSession]);

  const refreshSession = useCallback(async () => {
    return (await mutateSession()) ?? null;
  }, [mutateSession]);

  const pending =
    meError instanceof AuthError &&
    meError.status === 403 &&
    meError.reason === "PENDING_APPROVAL";
  const notPartner =
    meError instanceof AuthError &&
    meError.status === 403 &&
    meError.reason === "NOT_PARTNER";

  return {
    // Alias compatible: ahora es identidad verificada por el servidor,
    // no un usuario persistido por el SDK de Firebase en el navegador.
    firebaseUser: session ?? null,
    sessionUser: session ?? null,
    serverSession: !!session,
    me: me?.data ?? null,
    pending,
    notPartner,
    emailVerified: session?.emailVerified ?? false,
    sessionEmailVerified: session?.sessionEmailVerified ?? false,
    loading: sessionLoading || !!sessionError || (!!session && meLoading),
    refreshSession,
    refreshProfile: () => mutateMe(),
    signOut,
  };
}
