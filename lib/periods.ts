import { sql } from "@/lib/db";

// Meses/años en los que hay registros reales (ventas o transacciones) —
// usado para poblar los filtros de mes/año del panel, para que el partner
// solo pueda elegir un período que sí tiene datos (evita mostrar $0/0 en un
// mes donde ni siquiera había actividad todavía). Dos variantes: portafolio
// completo (dashboard, lista de emprendedores) y un solo emprendedor
// (detalle de organización).
export type AvailablePeriod = { year: number; month: number };

export async function getAvailablePeriods(partnerId: number): Promise<AvailablePeriod[]> {
  const rows = await sql`
    WITH portfolio AS (
      SELECT org_id FROM partner_organizations WHERE partner_id = ${partnerId}
    ),
    activity AS (
      SELECT sold_at AS at FROM sales WHERE org_id IN (SELECT org_id FROM portfolio)
      UNION ALL
      SELECT occurred_at AS at FROM transactions WHERE org_id IN (SELECT org_id FROM portfolio)
    )
    SELECT DISTINCT
      EXTRACT(YEAR FROM at)::int AS year,
      EXTRACT(MONTH FROM at)::int AS month
    FROM activity
    ORDER BY year DESC, month DESC
  `;
  return (rows as any[]).map((r) => ({ year: r.year, month: r.month }));
}

export async function getAvailablePeriodsForOrg(orgId: number): Promise<AvailablePeriod[]> {
  const rows = await sql`
    WITH activity AS (
      SELECT sold_at AS at FROM sales WHERE org_id = ${orgId}
      UNION ALL
      SELECT occurred_at AS at FROM transactions WHERE org_id = ${orgId}
    )
    SELECT DISTINCT
      EXTRACT(YEAR FROM at)::int AS year,
      EXTRACT(MONTH FROM at)::int AS month
    FROM activity
    ORDER BY year DESC, month DESC
  `;
  return (rows as any[]).map((r) => ({ year: r.year, month: r.month }));
}

export type SelectedPeriod = { year: number; month: number; periodStart: string };

// Parsea ?year=&month= del query string con la misma whitelist/fallback en
// todos lados donde se filtra por "mes seleccionado" (dashboard, lista y
// detalle de emprendedores) — nunca se interpola texto arbitrario del query
// string en el SQL, cae al mes calendario actual si falta o es inválido.
export function resolvePeriod(searchParams: URLSearchParams): SelectedPeriod {
  const now = new Date();
  const yearParam = Number(searchParams.get("year"));
  const monthParam = Number(searchParams.get("month"));
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : now.getUTCFullYear();
  const month = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getUTCMonth() + 1;
  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  return { year, month, periodStart };
}
