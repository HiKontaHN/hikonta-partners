"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WEEK_LABEL = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short" });

export type WeeklyTransactions = {
  weekStart: string; // "2026-08-04"
  count: number;
};

function formatWeek(weekStart: string) {
  return WEEK_LABEL.format(new Date(`${weekStart}T00:00:00`)).replace(".", "");
}

export function WeeklyTransactionsChart({ weeks }: { weeks: WeeklyTransactions[] }) {
  const data = weeks.map((w) => ({ ...w, label: formatWeek(w.weekStart) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transacciones por semana — últimas {weeks.length} semanas</CardTitle>
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
              width={32}
              allowDecimals={false}
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
              formatter={(value: number) => [value, "Transacciones"]}
            />
            <Bar dataKey="count" fill="var(--chip-blue)" radius={[6, 6, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
