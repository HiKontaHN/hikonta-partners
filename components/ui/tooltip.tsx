"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Tooltip con hover (desktop) + tap (mobile, donde no existe :hover real —
// ver feedback de diseño 2026-08-23). Se renderiza en un portal a
// document.body con `position: fixed` y coordenadas calculadas con
// getBoundingClientRect — a propósito, NO como `position: absolute` dentro
// del trigger: así escapa de cualquier ancestro con overflow clip (ej. el
// <main> con scroll del layout) y de cualquier stacking context, para que
// la nube SIEMPRE quede por encima de todo (incluido el header fijo) en vez
// de recortada/tapada cuando el trigger está pegado arriba de la pantalla.
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
    }
    // scroll/resize: el trigger pudo moverse — más simple cerrar que
    // reposicionar en cada frame.
    function handleScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  function openTooltip() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.top, left: rect.left + rect.width / 2 });
    setOpen(true);
  }

  function closeTooltip() {
    setOpen(false);
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex cursor-pointer"
        tabIndex={0}
        title={content}
        role="button"
        aria-expanded={open}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onClick={(e) => {
          // Evita que el tap también dispare un click en algo clickeable
          // alrededor (ej. si el tooltip vive dentro de una card/row).
          e.stopPropagation();
          open ? closeTooltip() : openTooltip();
        }}
      >
        {children}
      </span>
      {mounted &&
        open &&
        coords &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[100] w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-md bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-[var(--shadow-card)]"
            style={{ top: coords.top - 8, left: coords.left }}
          >
            {content}
          </span>,
          document.body
        )}
    </>
  );
}
