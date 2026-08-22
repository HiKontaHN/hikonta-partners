import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";
import { getAvailablePeriods } from "@/lib/periods";

// Meses/años con registros reales en el portafolio de este partner — ver
// lib/periods.ts. Alimenta los selects de Mes/Año del dashboard.
export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  try {
    const periods = await getAvailablePeriods(auth.data.partnerId);
    return Response.json({ data: periods });
  } catch (error) {
    console.error("GET /api/partner/dashboard/periods:", error);
    return createErrorResponse("Error al obtener los períodos disponibles", 500);
  }
}
