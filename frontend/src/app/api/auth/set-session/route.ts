// src/(auth)/api/auth/set-session/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true }); // do tohto res sa budú zapisovať cookies a toto aj vrátime

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options as CookieOptions)
        ),
      },
    }
  );

  const body = await req.json().catch(() => ({}));
  const event = body?.event as string | undefined;
  const session = body?.session;

  if (event === "SIGNED_OUT") {
    await sb.auth.signOut();
    return res;
  }

  if (event === "SIGNED_IN") {
    if (!session?.access_token || !session?.refresh_token) return new NextResponse(null, { status: 204 });
    const { error } = await sb.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return res;
  }

  return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
}
