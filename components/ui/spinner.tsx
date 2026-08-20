import { cn } from "@/lib/utils";

// Mismo círculo que ya usaba el estado "loading" de (partner)/layout.tsx —
// centralizado acá para no repetirlo a mano en cada página/sección.
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary",
        className
      )}
      style={{ width: size, height: size }}
    />
  );
}

// Reemplazo del "Cargando…" de texto en la carga inicial de una página
// completa — centra el spinner a la mitad del área de contenido (min-h-
// [60vh], no 100vh: <main> ya descuenta sidebar/navbar, así que esto lo
// centra dentro de lo que realmente se ve debajo de ellos).
export function PageSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-[60vh] items-center justify-center", className)}>
      <Spinner size={28} />
    </div>
  );
}

// Igual que PageSpinner pero para una SECCIÓN dentro de una página que ya
// tiene otro contenido arriba (ej. stat cards, historial de patrocinios) —
// min-h chico en vez de 60vh, si no dejaría un hueco enorme debajo de lo que
// ya se ve.
export function SectionSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-center py-10", className)}>
      <Spinner size={22} />
    </div>
  );
}
