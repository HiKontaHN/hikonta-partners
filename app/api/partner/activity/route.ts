import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { sql } from "@/lib/db";

// Actividad reciente derivada de sales/transactions (opción A del diseño).
// No hay tabla activity_log en HiKonta hoy — ver partner-dashboard-architecture.md.
export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const rows = await sql`
      SELECT * FROM (
        SELECT o.id AS org_id, o.name AS org_name, 'VENTA' AS action, s.sold_at AS occurred_at
        FROM sales s
        JOIN organizations o ON o.id = s.org_id
        WHERE o.id IN (SELECT org_id FROM partner_organizations WHERE partner_id = ${auth.data.partnerId})

        UNION ALL

        SELECT o.id, o.name, 'TRANSACCIÓN', t.occurred_at
        FROM transactions t
        JOIN organizations o ON o.id = t.org_id
        WHERE o.id IN (SELECT org_id FROM partner_organizations WHERE partner_id = ${auth.data.partnerId})
      ) recent
      ORDER BY occurred_at DESC
      LIMIT 20
    `;

    return Response.json({
      data: rows.map((r: any) => ({
        orgId: r.org_id,
        orgName: r.org_name,
        action: r.action,
        occurredAt: r.occurred_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/partner/activity:", error);
    return createErrorResponse("Error al obtener actividad reciente", 500);
  }
}
