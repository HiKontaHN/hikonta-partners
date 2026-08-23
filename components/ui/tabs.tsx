import { cn } from "@/lib/utils";

export type TabItem = { key: string; label: string };

// Mismo estilo "pill" que el resto del panel (ver Button) — scrollable
// horizontalmente si no entran todas las pestañas (mobile angosto).
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            active === tab.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
