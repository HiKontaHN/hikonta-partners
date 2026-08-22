"use client";

import { Select } from "@/components/ui/select";

// Filtro de mes/año compartido por dashboard, lista de emprendedores y
// detalle de organización — solo ofrece años/meses que vienen de un endpoint
// de "períodos disponibles" (ver lib/periods.ts en el backend), es decir,
// donde hay ventas o transacciones registradas de verdad. Dos selects
// encadenados: cambiar el año recorta el de mes a los meses disponibles ahí.
// Usa el Select propio (ver components/ui/select.tsx), no el <select> nativo
// — el listbox nativo lo dibuja el navegador/SO y quedaba básico e ignoraba
// el tema oscuro del panel.
export type AvailablePeriod = { year: number; month: number };

export const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function PeriodPicker({
  periods,
  value,
  onChange,
}: {
  periods: AvailablePeriod[];
  value: AvailablePeriod;
  onChange: (period: AvailablePeriod) => void;
}) {
  const years = Array.from(new Set(periods.map((p) => p.year))).sort((a, b) => b - a);
  const monthsForYear = periods.filter((p) => p.year === value.year).map((p) => p.month);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(value.month)}
        options={monthsForYear.map((m) => ({ value: String(m), label: MONTH_LABELS[m - 1] }))}
        onChange={(v) => onChange({ year: value.year, month: Number(v) })}
      />
      <Select
        value={String(value.year)}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
        onChange={(v) => {
          const year = Number(v);
          // El mes seleccionado puede no existir en el año nuevo — cae al
          // más reciente disponible de ese año.
          const monthsHere = periods.filter((p) => p.year === year).map((p) => p.month);
          onChange({ year, month: monthsHere.includes(value.month) ? value.month : monthsHere[0] });
        }}
      />
    </div>
  );
}

// Hook chico para el patrón repetido "elegir mes actual si tiene datos, si
// no el disponible más reciente" — usado por las 3 páginas que filtran por
// mes/año. Vive acá (no en un hooks/ separado) porque está pegado 1:1 a
// PeriodPicker: no tiene sentido usar uno sin el otro.
export function pickDefaultPeriod(periods: AvailablePeriod[]): AvailablePeriod | null {
  if (periods.length === 0) return null;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const hasCurrent = periods.some((p) => p.year === currentYear && p.month === currentMonth);
  return hasCurrent ? { year: currentYear, month: currentMonth } : periods[0];
}
