"use client";

import { createContext, useContext, useEffect, useMemo, useState, type DependencyList, type ReactNode } from "react";

// Slot para un header de página realmente FIJO — no `position: sticky`
// (que sigue viviendo DENTRO del contenedor con scroll y se "engancha" al
// tope al pasarlo). Este renderiza el header como hermano de <main> en
// (partner)/layout.tsx, shrink-0 y fuera del overflow-y-auto — el mismo
// mecanismo que ya usa el navbar para quedar fijo (ver comentario ahí).
// Una página empuja su contenido acá con usePageHeader(); se limpia solo al
// desmontar o cambiar de ruta.
const PageHeaderContext = createContext<((node: ReactNode) => void) | null>(null);
// Contexto separado solo para el VALOR a pintar — el setter (arriba) lo usan
// las páginas (hojas del árbol), el valor (acá) lo consume <PageHeaderOutlet
// /> más arriba, entre el navbar y <main> (ver layout.tsx). Ambos envuelven
// `children`, así que cualquier punto del árbol puede leer o escribir.
const PageHeaderOutletContext = createContext<ReactNode>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<ReactNode>(null);
  return (
    <PageHeaderContext.Provider value={setHeader}>
      <PageHeaderOutletContext.Provider value={header}>{children}</PageHeaderOutletContext.Provider>
    </PageHeaderContext.Provider>
  );
}

export function PageHeaderOutlet() {
  const header = useContext(PageHeaderOutletContext);
  if (!header) return null;
  // Mismo mx-auto max-w-6xl que envuelve {children} dentro de <main> — para
  // que el header "fijo" quede alineado con el contenido que scrollea justo
  // debajo.
  return <div className="mx-auto w-full max-w-6xl shrink-0">{header}</div>;
}

// `factory` se re-evalúa solo cuando cambia `deps` (igual que useMemo) — así
// no se dispara un loop de renders: si pasáramos el JSX ya armado, sería una
// referencia nueva en cada render de la página y el efecto de abajo
// dispararía en cada ciclo.
export function usePageHeader(factory: () => ReactNode, deps: DependencyList) {
  const setHeader = useContext(PageHeaderContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const node = useMemo(factory, deps);

  useEffect(() => {
    setHeader?.(node);
    return () => setHeader?.(null);
  }, [setHeader, node]);
}
