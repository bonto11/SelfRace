import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSb() {
  const c = cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      get(name: string) { return c.get(name)?.value; },
      set(name: string, value: string, options: CookieOptions) {
        c.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        c.set({ name, value: "", ...options });
      },
    },
  });
}

export async function POST(req: Request) {
  const sb = getSb();
  const { event, session } = await req.json().catch(() => ({}));

  if (event === "SIGNED_OUT") {
    await sb.auth.signOut();
    return NextResponse.json({ ok: true });
  }

  if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
    const { error } = await sb.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
}
