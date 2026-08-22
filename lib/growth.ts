// Helpers de % de variación compartidos por dashboard, lista y detalle de
// organización — mismo criterio en todos lados: nunca se inventa un %,
// null cuando no hay base contra qué comparar (ver documentation/dashboard.md
// y el comentario de lib/impact.ts sobre no exponer montos).

// % de variación entre dos valores. null si `prev` no es una base válida
// (0 o negativo) — dividir por eso daría un % sin sentido (o infinito).
export function pctChange(curr: number, prev: number): number | null {
  return prev > 0 ? Number((((curr - prev) / prev) * 100).toFixed(1)) : null;
}

// Crecimiento mes vs mes anterior, con fallback a un promedio móvil de los
// últimos N meses cuando el mes inmediatamente anterior no tiene datos (ej.
// portafolio nuevo, o un mes puntual sin ventas). Investigación: comparar
// contra un solo mes-1 se rompe apenas ese mes está en cero, y ahí
// normalmente se optaría por CMGR (tasa compuesta desde el primer dato) —
// pero CMGR también se rompe si el primer período fue $0 (muy común en
// emprendimientos nuevos). Un promedio móvil de los meses previos es el
// estándar más simple que no depende de que un único mes puntual tenga
// datos, y sigue sin inventar nada: si tampoco hay promedio válido, null.
export function monthOverMonthGrowth(thisMonth: number, lastMonth: number, trailingAvg: number): number | null {
  const vsLastMonth = pctChange(thisMonth, lastMonth);
  if (vsLastMonth !== null) return vsLastMonth;
  return pctChange(thisMonth, trailingAvg);
}
