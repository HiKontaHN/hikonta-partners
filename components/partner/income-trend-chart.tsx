"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
};

function formatMonth(month: string) {
  const label = MONTH_LABEL.format(new Date(`${month}-01T00:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "");
}

export function IncomeTrendChart({
  months,
  title,
}: {
  months: IncomeMonth[];
  title?: string;
}) {
  const data = months.map((m) => ({ ...m, label: formatMonth(m.month) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? `Ingresos combinados — últimos ${months.length} meses`}</CardTitle>
      </CardHeader>
      <CardContent className="h-72 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
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
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                color: "var(--popover-foreground)",
                fontSize: 13,
              }}
              formatter={(value: number) => [formatCurrency(value), "Ingresos"]}
            />
            <Bar dataKey="income" fill="var(--chip-green)" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
