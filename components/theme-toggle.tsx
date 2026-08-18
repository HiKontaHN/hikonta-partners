"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { Sun1Outlined, MoonHalfRight5Outlined } from "@lineiconshq/free-icons";
import { cn } from "@/lib/utils";

// Mismo patrón que components/theme-toggle.tsx en yelifin-sistema — el
// guard `mounted` evita el mismatch de hidratación (el theme real solo se
// conoce en el cliente).
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");
  const label = isDark ? "Modo claro" : "Modo oscuro";
  const icon = isDark ? Sun1Outlined : MoonHalfRight5Outlined;

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-full bg-muted text-sm font-semibold text-foreground transition-colors hover:bg-secondary",
        collapsed ? "h-9 w-9 shrink-0 justify-center" : "w-full px-4 py-2"
      )}
    >
      <Lineicons icon={icon} size={16} className={cn(!mounted && "opacity-0")} />
      {!collapsed && label}
    </button>
  );
}
