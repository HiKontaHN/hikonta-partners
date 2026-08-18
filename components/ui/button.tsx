import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

// Mismo estilo "pill" que ya usan los formularios de /login y /register —
// centralizado acá porque el panel de suscripciones es la primera pantalla
// del panel de partner con más de un botón de acción.
const variants = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-muted text-foreground hover:bg-muted/70",
} as const;

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      className={cn(
        "flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
