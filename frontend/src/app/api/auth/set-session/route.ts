//src/(auth)/api/auth/set-session/route
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });           // <- toto potom aj vrátime
  const jar = cookies();

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return jar.get(name)?.value; },
        set(name: string, value: string, options?: CookieOptions) {
          jar.set({ name, value, ...(options ?? {}) });
        },
        remove(name: string, options?: CookieOptions) {
          jar.set({ name, value: "", ...(options ?? {}), maxAge: 0 });
        },
      },
    }
  );

  const body = await req.json().catch(() => ({}));
  const event = body?.event as string | undefined;
  const session = body?.session;

  if (event === "SIGNED_OUT") {
    await sb.auth.signOut();
    return res;                                          // <- vraciame ten istý `res`
  }

  if (event === "SIGNED_IN") {
    if (!session?.access_token || !session?.refresh_token) {
      return new NextResponse(null, { status: 204 });    // ticho ignoruj neúplný payload
    }
    const { error } = await sb.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
    return res;                                          // <- vraciame `res`
  }

  return NextResponse.json({ ok:false, error:"bad_payload" }, { status:400 });
}
