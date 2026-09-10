"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Alias para no chocar con el Tooltip de recharts (el de arriba, para el
// hover sobre el gráfico) — este es el de "?" junto al título.
import { Tooltip as InfoTooltip } from "@/components/ui/tooltip";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { QuestionMarkCircleOutlined } from "@lineiconshq/free-icons";
import { formatCurrency } from "@/lib/utils";

const MONTH_LABEL = new Intl.DateTimeFormat("es-HN", { month: "short" });
const DAY_LABEL = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short" });
// Igual que el eje Y no necesita centavos — versión sin decimales de
// formatCurrency (misma moneda/locale que el resto del panel).
const CURRENCY_SHORT = new Intl.NumberFormat("es-HN", {
  style: "currency",
  currency: "HNL",
  maximumFractionDigits: 0,
});

export type IncomeMonth = {
  month: string; // "2026-08" en modo mensual, "2026-08-15" en modo diario
  // En modo "amount" son montos reales; en modo "percent" son % de
  // variación vs el período anterior — nunca ambas cosas a la vez (ver
  // financialChart en /api/partner/organizations/[id]). null cuando no hay
  // dato (ej. primer punto en modo percent, sin período anterior).
  income: number | null;
  profit?: number | null;
};

function formatPeriod(period: string, granularity: "month" | "day") {
  if (granularity === "day") {
    return DAY_LABEL.format(new Date(`${period}T00:00:00`)).replace(".", "");
  }
  const label = MONTH_LABEL.format(new Date(`${period}-01T00:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "");
}

export function IncomeTrendChart({
  months,
  title,
  note,
  showProfit = false,
  mode = "amount",
  granularity = "month",
}: {
  months: IncomeMonth[];
  title?: string;
  // Leyenda corta bajo el título — usada para explicar el modo % cuando la
  // org no autorizó compartir montos.
  note?: string;
  showProfit?: boolean;
  // "amount": montos reales (formatCurrency). "percent": solo % de
  // variación entre períodos — nunca se le pasan montos a este modo.
  mode?: "amount" | "percent";
  granularity?: "month" | "day";
}) {
  const data = months.map((m) => ({ ...m, label: formatPeriod(m.month, granularity) }));
  // Puede pasar que TODOS los puntos sean null: orgs nuevas sin ingresos en
  // el período anterior a ninguno de los meses mostrados (pctChange nunca
  // inventa un % contra una base en 0, ver lib/growth.ts). Sin este chequeo
  // el gráfico se renderiza vacío sin explicación — parece roto.
  const hasData = data.some((d) => d.income !== null || (showProfit && d.profit !== null));
  const periodWord = granularity === "day" ? "días" : "meses";
  const defaultTitle =
    mode === "percent"
      ? `Variación % de ingresos y ganancias — últimos ${months.length} ${periodWord}`
      : showProfit
        ? `Ingresos vs ganancias — últimos ${months.length} ${periodWord}`
        : `Ingresos combinados — últimos ${months.length} ${periodWord}`;

  const formatValue = (v: number) => (mode === "percent" ? `${v >= 0 ? "+" : ""}${v}%` : formatCurrency(v));
  const formatAxis = (v: number) => (mode === "percent" ? `${v}%` : CURRENCY_SHORT.format(v));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          {title ?? defaultTitle}
          {mode === "percent" && (
            <InfoTooltip content="Compara cada período con el anterior: si un mes creció 20% en ingresos, ese punto se dibuja en +20%. No es el ingreso real, solo cuánto varió respecto al período previo.">
              <Lineicons icon={QuestionMarkCircleOutlined} size={14} className="cursor-default text-muted-foreground/70" />
            </InfoTooltip>
          )}
        </CardTitle>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardHeader>
      <CardContent className="h-72 pt-4">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              Todavía no hay suficiente historial para calcular la variación.
            </p>
          </div>
        ) : (
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
                tickFormatter={formatAxis}
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
                formatter={(value: number, name) => [formatValue(value), name]}
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
                connectNulls
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
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
