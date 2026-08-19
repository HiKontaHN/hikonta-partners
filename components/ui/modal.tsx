"use client";

import { useEffect, type ReactNode } from "react";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { XmarkOutlined } from "@lineiconshq/free-icons";

// Diálogo genérico mínimo (sin Radix, ver decisión de "sin shadcn/ui" en el
// README) — isla flotante centrada, mismo lenguaje visual (`card-elevated`,
// `rounded-2xl`) que el resto del panel.
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = "max-w-sm",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  // La mayoría de los modales del panel son formularios cortos (max-w-sm
  // alcanza) — este override es para contenido más ancho, como una tabla
  // (ver InviteModal).
  maxWidthClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`card-elevated w-full ${maxWidthClassName} rounded-2xl bg-card p-6`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          >
            <Lineicons icon={XmarkOutlined} size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
