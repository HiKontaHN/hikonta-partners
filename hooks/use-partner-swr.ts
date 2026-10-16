"use client";

import useSWR from "swr";
import { useAuth } from "@/hooks/use-auth";

export function usePartnerSWR<T>(path: string | null) {
  const { serverSession } = useAuth();

  return useSWR<T>(
    serverSession && path ? path : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Error ${res.status} al llamar ${url}`);
      return res.json();
    },
    {
      revalidateOnFocus: false,
      // Mantiene los datos anteriores mientras llega la respuesta nueva
      // cuando cambia la key (ej. el filtro de período del detalle de
      // organización) — sin esto, `isLoading` vuelve a `true` en cada
      // cambio y la página entera parpadea a "Cargando…" en vez de
      // actualizar solo el gráfico.
      keepPreviousData: true,
    }
  );
}
