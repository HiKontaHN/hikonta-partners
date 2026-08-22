import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { computeImpact } from "@/lib/impact";
import { resolvePeriod } from "@/lib/periods";
import { monthOverMonthGrowth, pctChange } from "@/lib/growth";

// Umbrales de actividad — ver documentation/dashboard.md.
// No hay tracking de login en HiKonta, así que "actividad" se deriva de
// sales/transactions reales (mismo criterio que el resto del panel), no de
// sesiones. ACTIVO ≤30d, INACTIVO 30-90d, DORMANT >90d.
const ACTIVE_DAYS = 30;
const DORMANT_DAYS = 90;

// Cuántos emprendimientos "en alza" se destacan en la tabla resumen —
// pedido del partner en el rediseño del dashboard (ver dibujo en el chat).
const TOP_GROWTH_COUNT = 3;

// Fórmula de ganancia por línea de venta — costo directo + impuesto
// proporcional a esa línea. MISMA fórmula que organizations/[id]/route.ts
// (period_profit) y que "Ventas vs Ganancias" en yelifin-sistema — no
// duplicar la lógica con una fórmula distinta rompería la consistencia
// entre el detalle de una org y el agregado del portafolio.
const PROFIT_LINE_EXPR = `
  si.line_total
  - (si.unit_cost * si.quantity)
  - COALESCE(
      CASE
        WHEN (s.subtotal - s.discount) > 0
        THEN (s.tax * si.line_total / (s.subtotal - s.discount))
        ELSE 0
      END,
      0
    )
`;

export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  // Mes/año a mostrar en las métricas con corte de tiempo (ingresos y
  // transacciones) — ?year=&month=, default al mes calendario actual. Ver
  // lib/periods.ts (mismo helper que usan la lista y el detalle de
  // emprendedores, para que el criterio de whitelist/fallback sea uno solo).
  const { searchParams } = new URL(request.url);
  const { year, month, periodStart } = resolvePeriod(searchParams);

  try {
    const orgs = await sql`
      SELECT
        o.id, o.name, o.created_at,
        GREATEST(
          COALESCE((SELECT MAX(sold_at)     FROM sales        WHERE org_id = o.id), o.created_at),
          COALESCE((SELECT MAX(occurred_at) FROM transactions WHERE org_id = o.id), o.created_at)
        ) AS last_activity_at
      FROM organizations o
      WHERE o.id IN (SELECT org_id FROM partner_organizations WHERE partner_id = ${auth.data.partnerId})
    `;

    const now = Date.now();
    const daysSince = (d: string) => (now - new Date(d).getTime()) / 86_400_000;

    let active = 0, inactive = 0, dormant = 0;
    const alertOrgNames: string[] = [];
    for (const o of orgs as any[]) {
      const sinceActivity = daysSince(o.last_activity_at);
      const sinceCreated = daysSince(o.created_at);
      if (sinceActivity <= ACTIVE_DAYS) active++;
      else if (sinceActivity <= DORMANT_DAYS) inactive++;
      else dormant++;

      // "En alerta": inactivo/dormant Y no es una org recién creada que
      // todavía no tuvo tiempo de probar la plataforma.
      if (sinceActivity > ACTIVE_DAYS && sinceCreated > ACTIVE_DAYS) alertOrgNames.push(o.name);
    }
    const total = orgs.length;

    // Crecimiento en base a ingresos (mes vs mes anterior, todo el
    // portafolio) — pedido explícito del dibujo, con su propio filtro de
    // mes. A diferencia de la versión vieja de este endpoint, YA NO se
    // filtra por share_financials: nunca se expone el monto (ver política
    // de ética de datos financieros más abajo), así que calcular sobre el
    // valor real de TODAS las orgs no revela nada — solo se muestra el %.
    // Trae también los 3 meses previos para el fallback de promedio móvil
    // (ver lib/growth.ts) cuando el mes-1 no tiene datos.
    const incomeSeriesRows = await sql`
      WITH months AS (
        SELECT date_trunc('month', ${periodStart}::date) - (n || ' months')::interval AS month_start
        FROM generate_series(0, 3) AS n
      )
      SELECT m.month_start, COALESCE(SUM(s.total), 0) AS income
      FROM months m
      LEFT JOIN sales s
        ON s.org_id IN (SELECT org_id FROM partner_organizations WHERE partner_id = ${auth.data.partnerId})
        AND s.sold_at >= m.month_start AND s.sold_at < m.month_start + INTERVAL '1 month'
      GROUP BY m.month_start
      ORDER BY m.month_start DESC
    `;
    const [thisMonthIncome, lastMonthIncome, m2Income, m3Income] = (incomeSeriesRows as any[]).map((r) =>
      Number(r.income)
    );
    const trailingAvgIncome = (lastMonthIncome + m2Income + m3Income) / 3;
    const incomeGrowthPct = monthOverMonthGrowth(thisMonthIncome, lastMonthIncome, trailingAvgIncome);

    // Impacto del partner sobre cada org: actividad Y ganancia, promedio
    // ANTES vs DESPUÉS de vincularse (po.linked_at) — ver lib/impact.ts.
    // La ganancia usa la MISMA fórmula que organizations/[id]/route.ts
    // (line_total - costo - impuesto proporcional). Se calcula sobre el
    // valor real de ganancia de cada org (sin gate de share_financials: acá
    // adentro solo se usa para derivar %, el monto nunca sale del backend).
    const impactRows = await sql`
      SELECT
        o.id, o.name, o.created_at, po.linked_at,
        i.id AS industry_id, i.name AS industry_name,
        (SELECT COUNT(*) FROM sales s WHERE s.org_id = o.id
           AND s.sold_at >= o.created_at AND s.sold_at < po.linked_at) AS sales_before,
        (SELECT COUNT(*) FROM transactions t WHERE t.org_id = o.id
           AND t.occurred_at >= o.created_at AND t.occurred_at < po.linked_at) AS tx_before,
        (SELECT COUNT(*) FROM sales s WHERE s.org_id = o.id AND s.sold_at >= po.linked_at) AS sales_after,
        (SELECT COUNT(*) FROM transactions t WHERE t.org_id = o.id AND t.occurred_at >= po.linked_at) AS tx_after,
        COALESCE((
          SELECT SUM(${sql.unsafe(PROFIT_LINE_EXPR)})
          FROM sales s JOIN sale_items si ON si.sale_id = s.id AND si.org_id = s.org_id
          WHERE s.org_id = o.id AND s.sold_at >= o.created_at AND s.sold_at < po.linked_at
        ), 0) AS profit_before,
        COALESCE((
          SELECT SUM(${sql.unsafe(PROFIT_LINE_EXPR)})
          FROM sales s JOIN sale_items si ON si.sale_id = s.id AND si.org_id = s.org_id
          WHERE s.org_id = o.id AND s.sold_at >= po.linked_at
        ), 0) AS profit_after,
        COALESCE((SELECT SUM(total) FROM sales s WHERE s.org_id = o.id
          AND DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', ${periodStart}::date)), 0) AS income_this_month,
        COALESCE((SELECT SUM(total) FROM sales s WHERE s.org_id = o.id
          AND DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', ${periodStart}::date - INTERVAL '1 month')), 0) AS income_last_month,
        COALESCE((
          SELECT SUM(${sql.unsafe(PROFIT_LINE_EXPR)})
          FROM sales s JOIN sale_items si ON si.sale_id = s.id AND si.org_id = s.org_id
          WHERE s.org_id = o.id AND DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', ${periodStart}::date)
        ), 0) AS profit_this_month,
        COALESCE((
          SELECT SUM(${sql.unsafe(PROFIT_LINE_EXPR)})
          FROM sales s JOIN sale_items si ON si.sale_id = s.id AND si.org_id = s.org_id
          WHERE s.org_id = o.id AND DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', ${periodStart}::date - INTERVAL '1 month')
        ), 0) AS profit_last_month
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      LEFT JOIN industries i ON i.id = o.industry_id
    `;

    type OrgImpact = {
      id: number;
      name: string;
      industryId: number | null;
      industryName: string | null;
      profitGrowthPct: number | null;
      monthProfitGrowthPct: number | null;
      increasedSales: boolean;
    };

    const orgImpacts: OrgImpact[] = (impactRows as any[]).map((r) => {
      const daysBefore = (new Date(r.linked_at).getTime() - new Date(r.created_at).getTime()) / 86_400_000;
      const daysAfter = (now - new Date(r.linked_at).getTime()) / 86_400_000;

      const profit = computeImpact({
        beforeCount: Number(r.profit_before),
        afterCount: Number(r.profit_after),
        daysBefore,
        daysAfter,
      });

      const incomeThisMonth = Number(r.income_this_month);
      const incomeLastMonth = Number(r.income_last_month);

      return {
        id: r.id,
        name: r.name,
        industryId: r.industry_id,
        industryName: r.industry_name ?? "Sin sector",
        profitGrowthPct: profit.growthPct,
        // Crecimiento de ganancia mes vs mes anterior — a diferencia de
        // `profitGrowthPct` (desde que se unió al portafolio), esto no
        // depende de `linked_at`: entra cualquier org con datos este mes y
        // el anterior, sin importar cuándo se agregó al partner. Usado para
        // rankear "Emprendimientos en alza" (pedido explícito del partner).
        monthProfitGrowthPct: pctChange(Number(r.profit_this_month), Number(r.profit_last_month)),
        // "Aumentó ventas" = vendió más este mes que el anterior — cuenta
        // también el caso de arrancar desde $0 el mes pasado (0 > algo es
        // falso, pero algo > 0 si es verdadero cuenta como aumento real).
        increasedSales: incomeThisMonth > incomeLastMonth,
      };
    });

    // KPI "Impacto": % de emprendimientos del portafolio que aumentaron
    // ventas este mes vs el anterior — ver tarjeta "Impacto del portafolio"
    // del dibujo. Sobre el total del portafolio, no solo sobre los que
    // tienen ventas (un 0 en el denominador ya se cubre con `total`).
    const orgsIncreasedSalesCount = orgImpacts.filter((o) => o.increasedSales).length;
    const pctOrgsIncreasedSales = total > 0 ? Number(((orgsIncreasedSalesCount / total) * 100).toFixed(1)) : null;

    // KPI "Crecimiento": % de crecimiento en ganancia desde que cada org se
    // unió al portafolio, promediado mensual — mismo patrón antes/después
    // que el impacto de actividad, nunca se inventa un % (null si no hay
    // suficiente historial "antes", ver lib/impact.ts).
    const validProfitGrowths = orgImpacts
      .map((o) => o.profitGrowthPct)
      .filter((pct): pct is number => pct !== null);
    const avgProfitGrowthPct =
      validProfitGrowths.length > 0
        ? Number((validProfitGrowths.reduce((sum, pct) => sum + pct, 0) / validProfitGrowths.length).toFixed(1))
        : null;

    // "Sector con más crecimiento": promedio de % de crecimiento en
    // ganancia de las orgs de cada sector (mismo criterio que el KPI de
    // arriba), gana el sector con el promedio más alto. Solo entran orgs
    // con % válido — un sector sin ninguna org con historial suficiente no
    // compite (nunca se inventa un ganador).
    const bySector = new Map<string, { industryId: number | null; industryName: string; sum: number; count: number }>();
    for (const o of orgImpacts) {
      if (o.profitGrowthPct === null) continue;
      const key = o.industryId === null ? "none" : String(o.industryId);
      const entry = bySector.get(key) ?? { industryId: o.industryId, industryName: o.industryName ?? "Sin sector", sum: 0, count: 0 };
      entry.sum += o.profitGrowthPct;
      entry.count += 1;
      bySector.set(key, entry);
    }
    let topGrowthSector: { industryId: number | null; industryName: string; avgGrowthPct: number } | null = null;
    for (const entry of bySector.values()) {
      const avg = entry.sum / entry.count;
      if (topGrowthSector === null || avg > topGrowthSector.avgGrowthPct) {
        topGrowthSector = { industryId: entry.industryId, industryName: entry.industryName, avgGrowthPct: Number(avg.toFixed(1)) };
      }
    }

    // Tabla resumen: top 3 emprendimientos con más alza — rankeados por %
    // de crecimiento en ganancia del MES ACTUAL vs el anterior, sin importar
    // cuándo se agregaron al partner (a diferencia del KPI "Crecimiento" de
    // arriba, que sí depende de `linked_at`). Pedido explícito: una org
    // recién vinculada puede entrar acá aunque todavía no tenga suficiente
    // historial "antes de unirse" para el otro cálculo.
    const topGrowthOrgs = orgImpacts
      .filter((o) => o.monthProfitGrowthPct !== null)
      .sort((a, b) => (b.monthProfitGrowthPct as number) - (a.monthProfitGrowthPct as number))
      .slice(0, TOP_GROWTH_COUNT)
      .map((o) => ({ id: o.id, name: o.name, growthPct: o.monthProfitGrowthPct as number }));

    // Volumen de transacciones (conteo, no monto — no requiere opt-in
    // financiero, un conteo no revela cuánto factura nadie).
    const [txCount] = await sql`
      SELECT COUNT(*)::int AS count
      FROM sales s
      WHERE s.org_id IN (SELECT org_id FROM partner_organizations WHERE partner_id = ${auth.data.partnerId})
        AND DATE_TRUNC('month', s.sold_at) = DATE_TRUNC('month', ${periodStart}::date)
    `;

    // Distribución por sector/industria — sección 14 de ideas-feasibility.md.
    const sectorRows = await sql`
      SELECT i.id AS industry_id, i.name AS industry_name, COUNT(*)::int AS count
      FROM organizations o
      JOIN partner_organizations po ON po.org_id = o.id AND po.partner_id = ${auth.data.partnerId}
      LEFT JOIN industries i ON i.id = o.industry_id
      GROUP BY i.id, i.name
      ORDER BY count DESC, industry_name ASC NULLS LAST
    `;

    return Response.json({
      data: {
        partner: auth.data.partnerName,
        period: { year, month },
        summary: {
          totalOrganizations: total,
          activeOrganizations: active,
          inactiveOrganizations: inactive,
          dormantOrganizations: dormant,
          adoptionRate: total > 0 ? Number(((active / total) * 100).toFixed(2)) : 0,
          alertsCount: alertOrgNames.length,
          alertOrgNames,
          transactionsThisMonth: txCount.count,
          // Nunca se expone un monto acá — solo % (ver política de ética de
          // datos financieros, documentation/dashboard.md).
          incomeGrowthPct,
          pctOrgsIncreasedSales,
          orgsIncreasedSalesCount,
          avgProfitGrowthPct,
          profitGrowthOrgsCount: validProfitGrowths.length,
          topGrowthSector,
        },
        topGrowthOrganizations: topGrowthOrgs,
        sectorBreakdown: (sectorRows as any[]).map((s) => ({
          industryId: s.industry_id,
          industryName: s.industry_name ?? "Sin sector",
          count: s.count,
          pct: total > 0 ? Number(((s.count / total) * 100).toFixed(1)) : 0,
        })),
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/partner/dashboard:", error);
    return createErrorResponse("Error al obtener el dashboard", 500);
  }
}
