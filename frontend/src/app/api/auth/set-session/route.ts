// src/app/api/auth/set-session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Session } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { event?: "SIGNED_IN" | "SIGNED_OUT"; session?: Session };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { event, session } = body ?? {};

  const supabase = createRouteHandlerClient({ cookies });

  try {
    if (event === "SIGNED_OUT") {
      console.log("[SB][set-session] -> signOut()");
      await supabase.auth.signOut();
      return NextResponse.json({ ok: true });
    }

    if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      console.log("[SB][set-session] setSession", { ok: !error, err: error?.message ?? null });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    console.log("[SB][set-session] missing/invalid payload");
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  } catch (e: any) {
    console.error("[SB][set-session] ERROR", e?.message ?? e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
