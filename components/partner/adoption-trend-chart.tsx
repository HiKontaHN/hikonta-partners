"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MONTH_LABEL = new Intl.DateTimeFormat("es-HN", { month: "short" });

export type AdoptionMonth = {
  month: string; // "2026-08"
  adoptionRate: number;
  activeCount: number;
  enrolledCount: number;
};

function formatMonth(month: string) {
  const label = MONTH_LABEL.format(new Date(`${month}-01T00:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "");
}

export function AdoptionTrendChart({ months }: { months: AdoptionMonth[] }) {
  const data = months.map((m) => ({ ...m, label: formatMonth(m.month) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adopción digital — últimos {months.length} meses</CardTitle>
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
              width={44}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
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
              formatter={(value: number, _name, item) => [
                `${value}% (${item.payload.activeCount} de ${item.payload.enrolledCount})`,
                "Adopción",
              ]}
            />
            <Line
              type="monotone"
              dataKey="adoptionRate"
              stroke="var(--chip-blue)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--chip-blue)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
