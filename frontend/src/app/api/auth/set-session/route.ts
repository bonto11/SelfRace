// src/app/api/auth/set-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Session } from "@supabase/supabase-js";

//ggg
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { event, session } = body as { event?: string; session?: Session };

  const res = NextResponse.json({ ok: true, event: event ?? null }, { status: 200 });

  try {
    // 🟢 cookies() priamo z "next/headers" — správny spôsob pre Route Handlery
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    if (event === "SIGNED_OUT") {
      await supabase.auth.signOut();
      console.log("[SB][set-session] signOut → clearing cookies");
      return res;
    }

    if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      console.log("[SB][set-session] setSession", {
        ok: !error,
        err: error?.message ?? null,
      });
    } else {
      console.log("[SB][set-session] missing payload", { hasSession: !!session });
    }
  } catch (e: any) {
    console.error("[SB][set-session] ERROR", e?.message ?? e);
  }

  return res;
}
