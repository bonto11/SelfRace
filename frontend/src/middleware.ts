// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  try {
    const supabase = createMiddlewareClient({ req, res });
    const { data, error } = await supabase.auth.getSession();

    // DEBUG (v server logoch)
    console.log("[SB][mw]", {
      path: req.nextUrl.pathname,
      hasSession: !!data?.session,
      userId: data?.session?.user?.id ?? null,
      error: error?.message ?? null,
    });
  } catch (e: any) {
    console.error("[SB][mw] ERROR", e?.message ?? e);
  }

  return res;
}

// nechaj bežať všade okrem statík/obrázkov
export const config = {
  matcher: [
    // ignoruje _next statické veci a obrázky
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
