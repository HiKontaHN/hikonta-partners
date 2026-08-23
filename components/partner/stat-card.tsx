import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { Lineicons } from "@lineiconshq/react-lineicons";
import type { LineiconsProps } from "@lineiconshq/react-lineicons";
import { QuestionMarkCircleOutlined } from "@lineiconshq/free-icons";

type IconValue = LineiconsProps["icon"];

// Solo dos tonos: azul (marca, valor por defecto) y verde (indicador
// positivo — crecimiento, éxito). Nada de amber/purple decorativo, ver
// feedback de diseño 2026-08-23.
const CHIP = {
  blue: { fg: "var(--chip-blue)", bg: "var(--chip-blue-bg)" },
  green: { fg: "var(--chip-green)", bg: "var(--chip-green-bg)" },
} as const;

export function StatCard({
  title,
  value,
  icon,
  tone = "blue",
  subtitle,
  badge,
  info,
}: {
  title: string;
  value: ReactNode;
  icon: IconValue;
  tone?: keyof typeof CHIP;
  subtitle?: string;
  badge?: ReactNode;
  // Texto simple (sin jerga) de cómo se calcula el KPI — se muestra con un
  // ícono de "?" junto al título, en hover/focus (ver Tooltip).
  info?: string;
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
      <p className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
        {title}
        {info && (
          <Tooltip content={info}>
            <Lineicons icon={QuestionMarkCircleOutlined} size={14} className="cursor-default text-muted-foreground/70" />
          </Tooltip>
        )}
      </p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </Card>
  );
}
