// middleware.ts
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // ✅ novšie API: getAll / setAll
      cookies: {
        getAll() {
          // NextRequest.cookies.getAll() => {name,value}[]
          return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options as any);
          }
        },
      },
      // voliteľné: cookieEncoding: "raw",
    }
  );

  // len ak už sú tokeny, inak to spamuje 400
  const hasAnyToken =
    req.cookies.has("sb-access-token") || req.cookies.has("sb-refresh-token");

  if (hasAnyToken) {
    try {
      await supabase.auth.getUser();
    } catch {
      // ignoruj prípadné 400/refresh bez tokenu
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
