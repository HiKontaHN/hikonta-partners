import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const variants = {
  success: "bg-chip-green-bg text-chip-green",
  warning: "bg-chip-amber-bg text-chip-amber",
  muted: "bg-muted text-muted-foreground",
} as const;

export function Badge({
  variant = "muted",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
