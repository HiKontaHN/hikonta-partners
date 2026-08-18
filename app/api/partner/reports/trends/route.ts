import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// Fase 2 de documentation/dashboard.md — series mensuales para los gráficos
// de la página Reportes (adopción + ingresos, últimos 6 meses).
//
// No hay tracking de login en HiKonta (ver reports/adoption y dashboard),
// así que "activo en el mes X" se deriva igual que en el resto del panel:
// tuvo al menos una venta o transacción dentro de ese mes calendario. El
// enrolled_count de cada mes respeta `linked_at` para no contar orgs que
// todavía no estaban vinculadas al partner en ese momento.
const MONTHS = 6;

export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const rows = await sql`
      WITH months AS (
        SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
        FROM generate_series(${MONTHS - 1}, 0, -1) AS n
      ),
      portfolio AS (
        SELECT o.id, po.linked_at, po.share_financials
        FROM organizations o
        JOIN partner_organizations po ON po.org_id = o.id
        WHERE po.partner_id = ${auth.data.partnerId}
      ),
      enrolled AS (
        SELECT m.month_start, COUNT(*)::int AS enrolled_count
        FROM months m
        JOIN portfolio p ON p.linked_at < m.month_start + INTERVAL '1 month'
        GROUP BY m.month_start
      ),
      active AS (
        SELECT m.month_start, COUNT(DISTINCT p.id)::int AS active_count
        FROM months m
        JOIN portfolio p ON p.linked_at < m.month_start + INTERVAL '1 month'
        WHERE
          EXISTS (
            SELECT 1 FROM sales s
            WHERE s.org_id = p.id
              AND s.sold_at >= m.month_start AND s.sold_at < m.month_start + INTERVAL '1 month'
          )
          OR EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.org_id = p.id
              AND t.occurred_at >= m.month_start AND t.occurred_at < m.month_start + INTERVAL '1 month'
          )
        GROUP BY m.month_start
      ),
      income AS (
        SELECT m.month_start, COALESCE(SUM(s.total), 0) AS income
        FROM months m
        JOIN portfolio p ON p.share_financials = TRUE AND p.linked_at < m.month_start + INTERVAL '1 month'
        LEFT JOIN sales s
          ON s.org_id = p.id
          AND s.sold_at >= m.month_start AND s.sold_at < m.month_start + INTERVAL '1 month'
        GROUP BY m.month_start
      )
      SELECT
        m.month_start,
        COALESCE(e.enrolled_count, 0) AS enrolled_count,
        COALESCE(a.active_count, 0) AS active_count,
        COALESCE(i.income, 0) AS income
      FROM months m
      LEFT JOIN enrolled e ON e.month_start = m.month_start
      LEFT JOIN active   a ON a.month_start = m.month_start
      LEFT JOIN income   i ON i.month_start = m.month_start
      ORDER BY m.month_start
    `;

    const months = (rows as any[]).map((r) => {
      const enrolled = r.enrolled_count as number;
      const active = r.active_count as number;
      return {
        // neon-serverless a veces devuelve `timestamp` como Date y a veces
        // como string según el contexto de ejecución — normalizar con
        // `new Date(...)` cubre ambos casos.
        month: new Date(r.month_start).toISOString().slice(0, 7), // "2026-08"
        enrolledCount: enrolled,
        activeCount: active,
        adoptionRate: enrolled > 0 ? Number(((active / enrolled) * 100).toFixed(1)) : 0,
        income: Number(r.income),
      };
    });

    return Response.json({ data: { months } });
  } catch (error) {
    console.error("GET /api/partner/reports/trends:", error);
    return createErrorResponse("Error al obtener las tendencias", 500);
  }
}
