import { NextRequest } from "next/server";
import { verifyPartner, createErrorResponse, isAuthSuccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await verifyPartner(request);
  if (!isAuthSuccess(auth)) return createErrorResponse(auth.error, auth.status, auth.reason);

  return Response.json({
    data: {
      partnerId: auth.data.partnerId,
      partnerName: auth.data.partnerName,
      email: auth.data.email,
      displayName: auth.data.displayName,
    },
  });
}
