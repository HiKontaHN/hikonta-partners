import type { NextRequest } from "next/server";

/** Permite túneles/orígenes distintos únicamente durante desarrollo. */
export function hasValidRequestOrigin(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return request.headers.get("origin") === request.nextUrl.origin;
}

