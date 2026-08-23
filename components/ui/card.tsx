import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

// Estilo One UI: sin borde duro, la superficie se distingue por sombra
// suave y radio grande (--radius-xl ≈ 28px).
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // min-w-0: sin esto, un Card usado como grid/flex item puede quedar
      // más ancho que su columna si algo adentro no puede achicarse (texto
      // sin wrap, etc.) — forzando scroll horizontal en vez de que el
      // truncate interno haga su trabajo. No afecta a un Card fuera de un
      // contexto grid/flex.
      className={cn("card-elevated min-w-0 rounded-xl bg-card text-card-foreground", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-sm font-medium text-muted-foreground", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}
