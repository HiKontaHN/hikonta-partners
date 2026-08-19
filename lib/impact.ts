// "Impacto" del partner sobre un emprendedor: crecimiento en actividad
// (ventas + transacciones, sin montos — ver feedback de partner real en
// documentation/progress.md) comparando el promedio mensual ANTES de
// vincularse a su portafolio (po.linked_at) vs DESPUÉS. A propósito NO usa
// dinero: los emprendedores no siempre reportan montos con exactitud, y
// mostrárselos al partner no es apropiado (ver share_financials en el resto
// del panel) — el conteo de actividad no tiene ese problema.
//
// Usado por /api/partner/organizations/[id] (una org) y /api/partner/dashboard
// (promedio del portafolio) — misma fórmula en los dos para que el número
// que ve el partner en el detalle sea consistente con el resumen agregado.

// Con menos de 14 días de historial "antes" de vincularse, el promedio
// mensual es demasiado ruidoso para reportar un % serio (ver mismo criterio
// de "no inventar" que ya usan los badges de tendencia de ingresos).
export const IMPACT_MIN_BASELINE_DAYS = 14;

export type ImpactWindow = {
  beforeCount: number;
  afterCount: number;
  daysBefore: number;
  daysAfter: number;
};

export type ImpactResult = {
  beforeAvgMonthly: number;
  afterAvgMonthly: number;
  // % de crecimiento del promedio mensual de actividad. null si no hay
  // suficiente historial "antes" para comparar (nunca se inventa un %).
  growthPct: number | null;
  hasBaseline: boolean;
  // Caso especial: no tenía actividad antes de unirse y sí tiene después —
  // un % no tiene sentido (división por cero), pero SÍ es una historia de
  // impacto real ("empezó a operar después de unirse").
  startedFromZero: boolean;
};

export function computeImpact({ beforeCount, afterCount, daysBefore, daysAfter }: ImpactWindow): ImpactResult {
  const hasBaseline = daysBefore >= IMPACT_MIN_BASELINE_DAYS;
  const beforeAvgMonthly = daysBefore > 0 ? (beforeCount / daysBefore) * 30 : 0;
  // Math.max(daysAfter, 1) evita dividir por ~0 el mismo día que se vincula.
  const afterAvgMonthly = daysAfter > 0 ? (afterCount / Math.max(daysAfter, 1)) * 30 : 0;

  const growthPct =
    hasBaseline && beforeAvgMonthly > 0
      ? Number((((afterAvgMonthly - beforeAvgMonthly) / beforeAvgMonthly) * 100).toFixed(1))
      : null;
  const startedFromZero = hasBaseline && beforeAvgMonthly === 0 && afterAvgMonthly > 0;

  return {
    beforeAvgMonthly: Number(beforeAvgMonthly.toFixed(1)),
    afterAvgMonthly: Number(afterAvgMonthly.toFixed(1)),
    growthPct,
    hasBaseline,
    startedFromZero,
  };
}
