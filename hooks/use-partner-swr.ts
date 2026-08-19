"use client";

import useSWR from "swr";
import { useAuth } from "@/hooks/use-auth";

export function usePartnerSWR<T>(path: string | null) {
  const { token } = useAuth();

  return useSWR<T>(
    token && path ? [path, token] : null,
    // SWR llama al fetcher con UN solo argumento: la key tal cual (el array
    // completo), no la separa — hay que desestructurarla adentro.
    async ([url, tok]: [string, string]) => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
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
