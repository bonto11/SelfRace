//src/(auth)/api/auth/set-session/route
// /src/(auth)/api/auth/set-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  // VŠETKO zapisujeme do *tohto* res, ktorý aj VRACIAME.
  const res = NextResponse.json({ ok: true });

  const sb = createServerClient(URL, ANON, {
    cookies: {
      // prečítaj všetky cookies z requestu
      getAll() {
        return req.cookies.getAll().map(c => ({ name: c.name, value: c.value }));
      },
      // ZAPISUJ do res.cookies – len tak sa odošlú Set-Cookie headre
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          res.cookies.set(name, value, options as CookieOptions);
        }
      },
    },
  });

  const body = await req.json().catch(() => ({}));
  const event = body?.event as string | undefined;
  const session = body?.session;

  if (event === "SIGNED_OUT") {
    await sb.auth.signOut();
    return res; // vraciame ten istý res
  }

  if (event === "SIGNED_IN") {
    if (!session?.access_token || !session?.refresh_token) {
      return new NextResponse(null, { status: 204 }); // ticho ignoruj neúplný payload
    }
    const { error } = await sb.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return res; // cookies už sú v res
  }

  return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
}
