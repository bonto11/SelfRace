// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  // odpoveď, do ktorej môže Supabase zapisovať cookies
  const res = NextResponse.next();

  try {
    // jednoduchý log, nech vidíš že middleware beží
    console.log("[SB][mw] start", { path: req.nextUrl.pathname });

    // klient naviazaný na req/res → umožní refreshnúť session a uložiť cookies
    const supabase = createMiddlewareClient({ req, res });

    // toto ticho spraví refresh, ak treba
    const { data, error } = await supabase.auth.getSession();

    console.log("[SB][mw] getSession", {
      hasSession: !!data?.session,
      userId: data?.session?.user?.id ?? null,
      error: error?.message ?? null,
    });
  } catch (e: any) {
    console.error("[SB][mw] ERROR", e?.message ?? e);
  }

  return res;
}

// ignoruj statické assety atď.
export const config = {
  matcher: [
    // všetko okrem _next/static, _next/image, favicon a obrázkov
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
