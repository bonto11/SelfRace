//src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(c => ({ name: c.name, value: c.value }));
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            res.cookies.set(name, value, options as CookieOptions);
          }
        },
      },
    }
  );

  const { data, error } = await sb.auth.getUser();
  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    user: data?.user ? { id: data.user.id, email: data.user.email } : null,
    // len na debuggovanie, odstráň potom:
    hasAccess: !!req.cookies.get("sb-access-token"),
    hasRefresh: !!req.cookies.get("sb-refresh-token"),
  });
}
