import { Button } from "@/components/ui/button";
import { Lineicons } from "@lineiconshq/react-lineicons";
import { ArrowLeftOutlined, ArrowRightOutlined } from "@lineiconshq/free-icons";

// Extraído de HistorySection (subscriptions/page.tsx) para no repetir el
// mismo par de botones Anterior/Siguiente en cada sección paginada del
// panel.
export function Pagination({
  page,
  pages,
  total,
  itemLabel,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  // Ej. "patrocinio" → "1 patrocinio" / "3 patrocinios".
  itemLabel: string;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;

  return (
    <div className="mt-3 flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        Página {page} de {pages} · {total} {itemLabel}
        {total === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          <Lineicons icon={ArrowLeftOutlined} size={13} />
          Anterior
        </Button>
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={page >= pages}
          onClick={() => onChange(Math.min(pages, page + 1))}
        >
          Siguiente
          <Lineicons icon={ArrowRightOutlined} size={13} />
        </Button>
      </div>
    </div>
  );
}
