import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// kompat vrstva: funguje pre staré aj nové typy @supabase/ssr
function compatCookies() {
  const c = cookies();
  return {
    // nové API
    get: (name: string) => c.get(name)?.value,
    set: (name: string, value: string, options?: any) =>
      c.set({ name, value, ...(options ?? {}) }),
    remove: (name: string, options?: any) =>
      c.set({ name, value: "", ...(options ?? {}), maxAge: 0 }),

    // staré (deprecated) názvy – TS nebude frflať a runtime to nebolí
    getCookie: (name: string) => c.get(name)?.value,
    setCookie: (name: string, value: string, options?: any) =>
      c.set({ name, value, ...(options ?? {}) }),
    removeCookie: (name: string, options?: any) =>
      c.set({ name, value: "", ...(options ?? {}), maxAge: 0 }),
  } as any;
}

function getSb() {
  return createServerClient(URL, ANON, {
    cookies: compatCookies(),
  });
}

export async function POST(req: Request) {
  const sb = getSb();

  let payload: any = {};
  try { payload = await req.json(); } catch {}

  const event   = payload?.event as string | undefined;
  const session = payload?.session;

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
