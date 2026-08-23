import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { Lineicons } from "@lineiconshq/react-lineicons";
import type { LineiconsProps } from "@lineiconshq/react-lineicons";
import { QuestionMarkCircleOutlined } from "@lineiconshq/free-icons";

type IconValue = LineiconsProps["icon"];

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  badge,
  info,
}: {
  title: string;
  value: ReactNode;
  icon: IconValue;
  subtitle?: string;
  badge?: ReactNode;
  // Texto simple (sin jerga) de cómo se calcula el KPI — se muestra con un
  // ícono de "?" junto al título, en hover/focus (ver Tooltip).
  info?: string;
}) {
  return (
    <Card className="p-5">
      {/* Ícono chico junto al título, del mismo color que el texto — sin
          círculo de fondo ni paleta de colores por card (se veía "hecho por
          IA"), ver feedback de diseño 2026-08-23. */}
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-md font-medium text-muted-foreground">
          <Lineicons icon={icon} size={25} className="shrink-0 text-muted-foreground" />
          {title}
          {info && (
            <Tooltip content={info}>
              <Lineicons icon={QuestionMarkCircleOutlined} size={14} className="cursor-default text-muted-foreground/70" />
            </Tooltip>
          )}
        </p>
        {badge}
      </div>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </Card>
  );
}
