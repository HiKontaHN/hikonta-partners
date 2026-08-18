"use client";

import { useState } from "react";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { Locked1Outlined, EyeOutlined } from "@lineiconshq/free-icons";

// El plan gratuito de Lineicons solo trae EyeOutlined (sin variante
// "ojo tachado") — el estado "visible" se marca superponiendo una línea
// diagonal sobre el mismo ícono en vez de cambiar de glifo.
export function PasswordField({
  label = "Contraseña",
  value,
  onChange,
  required,
  minLength,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
        <Lineicons icon={Locked1Outlined} size={16} /> {label}
      </span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-full border-0 bg-muted px-4 py-2.5 pr-11 text-sm outline-none ring-1 ring-transparent focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <span className="relative inline-flex h-4 w-4 items-center justify-center">
            <Lineicons icon={EyeOutlined} size={16} />
            {visible && <span className="absolute h-px w-[18px] rotate-45 bg-current" />}
          </span>
        </button>
      </div>
    </label>
  );
}
