"use client";

import { useEffect, useRef, useState } from "react";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { ChevronDownOutlined, CheckOutlined } from "@lineiconshq/free-icons";
import { cn } from "@/lib/utils";

// Select propio — el <select> nativo no se puede estilizar de verdad: el
// listbox lo dibuja el sistema operativo/navegador, así que quedaba blanco y
// con tipografía básica sin importar el tema oscuro del resto del panel
// (reportado por el partner con captura). Mismo look "One UI" que el resto
// de los controles (trigger rounded-full, panel tipo Card — ver
// components/ui/card.tsx) en vez del feedback visual nativo del SO.
export type SelectOption = { value: string; label: string };

export function Select({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  // Cierra al clickear afuera o con Escape — el <select> nativo lo hacía
  // gratis, acá hay que replicarlo a mano.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground outline-none ring-1 ring-transparent transition-colors hover:bg-secondary focus:ring-2 focus:ring-ring"
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <Lineicons
          icon={ChevronDownOutlined}
          size={12}
          className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="card-elevated absolute left-0 top-[calc(100%+6px)] z-40 max-h-64 min-w-full overflow-y-auto rounded-xl bg-card p-1 shadow-xl"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-muted",
                o.value === value ? "text-primary" : "text-foreground"
              )}
            >
              {o.label}
              {o.value === value && <Lineicons icon={CheckOutlined} size={12} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
