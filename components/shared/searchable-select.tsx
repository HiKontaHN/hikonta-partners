"use client";

import { useEffect, useRef, useState } from "react";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { ChevronDownOutlined, CheckOutlined } from "@lineiconshq/free-icons";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = { value: string; label: string };

interface SearchableSelectProps {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  align?: "start" | "end";
  disabled?: boolean;
}

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  className,
  align = "start",
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const filtered = normalizedSearch
    ? options.filter((option) => option.label.toLocaleLowerCase("es").includes(normalizedSearch))
    : options;

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-full w-full items-center justify-between gap-2 rounded-full bg-muted px-4 text-sm font-medium text-foreground outline-none ring-1 ring-transparent transition-colors hover:bg-secondary focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <Lineicons
          icon={ChevronDownOutlined}
          size={14}
          className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          className={cn(
            "card-elevated absolute top-[calc(100%+6px)] z-50 w-48 overflow-hidden rounded-xl bg-card shadow-xl",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <div className="border-b border-border p-2">
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full rounded-lg border-0 bg-muted px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
          </div>

          <div role="listbox" className="max-h-56 overscroll-contain overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs text-muted-foreground">
                No se encontraron resultados
              </p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    option.value === value ? "font-semibold text-primary" : "text-foreground",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Lineicons icon={CheckOutlined} size={13} className="shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
