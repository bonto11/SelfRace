// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  // response, do ktorého supabase môže zapisovať cookies
  const res = NextResponse.next();

  // klient naviazaný na req/res – umožní refreshnúť session a zapísať cookie
  const supabase = createMiddlewareClient({ req, res });

  // Toto zavolanie ticho spraví refresh, ak je treba, a zapíše nové cookies do res
  await supabase.auth.getSession();

   const s = await supabase.auth.getSession();
  console.log("[MW] has session:", !!s.data.session, "expires_at:", s.data.session?.expires_at);

  return res;
}

// ignoruj statické assety atď.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
 