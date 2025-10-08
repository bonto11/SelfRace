//src/(auth)/api/auth/set-session/route
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function serverClient(req: NextRequest, res: NextResponse) {
  return createServerClient(URL, ANON, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        // zápis cookie je povolený v route handleri cez NextResponse
        res.cookies.set(name, value, options as any);
      },
      remove(name: string, _options?: CookieOptions) {
        // stačí delete; Supabase si poradí
        res.cookies.delete(name);
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any;
  const event   = body?.event as string | undefined;
  const session = body?.session;

  if (event === "SIGNED_OUT") {
    const res = NextResponse.json({ ok: true });
    const sb = serverClient(req, res);
    await sb.auth.signOut();
    return res;
  }

  if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
    const res = NextResponse.json({ ok: true });
    const sb = serverClient(req, res);
    const { error } = await sb.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return res;
  }

  return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
}
