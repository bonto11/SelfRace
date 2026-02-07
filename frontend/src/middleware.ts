// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  

  // 1) Lokálne ignoruj statické veci a API – matcher potom môže byť len '/:path*'
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  try {
    // 2) Supabase klient naviazaný na req/res — tu si vie zapisovať/refreshnúť cookies
    const supabase = createMiddlewareClient({ req, res });

    // 3) Tichý refresh / bootstrap cookies (nič nepresmerúvame)
    const { data, error } = await supabase.auth.getSession();

  } catch (e: any) {
    console.error("[SB][mw] ERROR", e?.message ?? e);
  }

  return res;
}

// Žiadne komplikované regexy – aplikuj na všetky cesty, ignorovanie riešime vyššie.
export const config = {
  matcher: ["/:path*"],
};
