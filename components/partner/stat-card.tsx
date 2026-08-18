import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Lineicons } from "@lineiconshq/react-lineicons";
import type { LineiconsProps } from "@lineiconshq/react-lineicons";

type IconValue = LineiconsProps["icon"];

const CHIP = {
  blue: { fg: "var(--chip-blue)", bg: "var(--chip-blue-bg)" },
  green: { fg: "var(--chip-green)", bg: "var(--chip-green-bg)" },
  amber: { fg: "var(--chip-amber)", bg: "var(--chip-amber-bg)" },
  purple: { fg: "var(--chip-purple)", bg: "var(--chip-purple-bg)" },
} as const;

export function StatCard({
  title,
  value,
  icon,
  tone = "blue",
  subtitle,
  badge,
}: {
  title: string;
  value: string | number;
  icon: IconValue;
  tone?: keyof typeof CHIP;
  subtitle?: string;
  badge?: ReactNode;
}) {
  const chip = CHIP[tone];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: chip.bg }}
        >
          <Lineicons icon={icon} size={20} color={chip.fg} />
        </div>
        {badge}
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </Card>
  );
}
