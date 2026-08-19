"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const MONTH_LABEL = new Intl.DateTimeFormat("es-HN", { month: "short" });
// Igual que el eje Y no necesita centavos — versión sin decimales de
// formatCurrency (misma moneda/locale que el resto del panel).
const CURRENCY_SHORT = new Intl.NumberFormat("es-HN", {
  style: "currency",
  currency: "HNL",
  maximumFractionDigits: 0,
});

export type IncomeMonth = {
  month: string; // "2026-08"
  income: number;
  // Solo viene poblado en el detalle de organización (requiere costos por
  // sale_item, ver /api/partner/organizations/[id]) — en Reportes (trends
  // agregado del portafolio) no se calcula, por eso es opcional.
  profit?: number;
};

function formatMonth(month: string) {
  const label = MONTH_LABEL.format(new Date(`${month}-01T00:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "");
}

export function IncomeTrendChart({
  months,
  title,
  showProfit = false,
}: {
  months: IncomeMonth[];
  title?: string;
  // Ingresos vs Ganancias (línea igual a "Ventas vs Ganancias" de
  // yelifin-sistema) — solo el detalle de organización manda profit por mes.
  showProfit?: boolean;
}) {
  const data = months.map((m) => ({ ...m, label: formatMonth(m.month) }));
  const defaultTitle = showProfit
    ? `Ingresos vs ganancias — últimos ${months.length} meses`
    : `Ingresos combinados — últimos ${months.length} meses`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? defaultTitle}</CardTitle>
      </CardHeader>
      <CardContent className="h-72 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              width={64}
              tickFormatter={(v) => CURRENCY_SHORT.format(v)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                color: "var(--popover-foreground)",
                fontSize: 13,
              }}
              formatter={(value: number, name) => [formatCurrency(value), name]}
            />
            {showProfit && (
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, fontWeight: 500, paddingTop: 8 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="income"
              name="Ingresos"
              stroke="var(--chip-blue)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
            {showProfit && (
              <Line
                type="monotone"
                dataKey="profit"
                name="Ganancias"
                stroke="var(--chip-green)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
