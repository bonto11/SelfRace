// src/app/api/auth/set-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serverClient(req: NextRequest, res: NextResponse) {
  const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(URL, ANON, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set(name, value, options as any);
      },
      remove(name: string) {
        res.cookies.delete(name);
      },
    },
  });
}

type Body = { event?: "SIGNED_IN" | "SIGNED_OUT"; session?: Session };

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { event, session } = body ?? {};

  const res = NextResponse.json({ ok: true }); // budeme doň zapisovať cookies
  const supabase = serverClient(req, res);

  try {
    if (event === "SIGNED_OUT") {
      console.log("[SB][set-session] signOut -> clearing cookies");
      await supabase.auth.signOut();
      return res;
    }

    if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      console.log("[SB][set-session] setSession", { ok: !error, err: error?.message ?? null });
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return res; // obsahuje Set-Cookie
    }

    console.log("[SB][set-session] invalid payload", { hasSession: !!session });
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  } catch (e: any) {
    console.error("[SB][set-session] ERROR", e?.message ?? e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
