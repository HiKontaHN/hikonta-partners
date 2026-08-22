import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess, requireOwnedOrganization } from "@/lib/auth";
import { getAvailablePeriodsForOrg } from "@/lib/periods";

// Meses/años con registros reales de ESTE emprendedor (no todo el
// portafolio, a diferencia de /api/partner/dashboard/periods) — ver
// lib/periods.ts. Alimenta el filtro de mes/año del detalle de organización.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status);

  const orgId = Number((await params).id);
  if (!Number.isFinite(orgId)) return createErrorResponse("Id inválido", 400);

  const deny = await requireOwnedOrganization(auth.data.partnerId, orgId);
  if (deny) return deny;

  try {
    const periods = await getAvailablePeriodsForOrg(orgId);
    return Response.json({ data: periods });
  } catch (error) {
    console.error("GET /api/partner/organizations/[id]/periods:", error);
    return createErrorResponse("Error al obtener los períodos disponibles", 500);
  }
}
