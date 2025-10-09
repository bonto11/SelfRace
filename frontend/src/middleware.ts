// src/middleware.ts

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (cookies) => cookies.forEach(({name, value, options}) =>
          res.cookies.set(name, value, options as CookieOptions)
        ),
      },
    }
  );

  // voliteľné: len ak už sú tokeny, osviež usera
  if (req.cookies.has("sb-access-token") || req.cookies.has("sb-refresh-token")) {
    try { await sb.auth.getUser(); } catch {}
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
