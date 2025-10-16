// src/app/api/auth/set-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { event?: "SIGNED_IN" | "SIGNED_OUT"; session?: Session | null };

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { event, session } = body;

  console.log("[set-session] incoming", {
    event,
    hasSession: !!session,
    atLen: session?.access_token?.length ?? 0,
    rtLen: session?.refresh_token?.length ?? 0,
  });

  // pripravíme response, do ktorého budeme zapisovať cookies
  const res = NextResponse.json({ ok: true });

  // Supabase client s cookie adaptérmi: get z requestu, set/remove do response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          res.cookies.set(name, value, options);
        },
        remove: (name: string, options: any) => {
          res.cookies.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );

  try {
    if (event === "SIGNED_OUT") {
      console.log("[set-session] supabase.auth.signOut()");
      await supabase.auth.signOut();
      return res;
    }

    if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
      console.log("[set-session] supabase.auth.setSession()");
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) {
        console.error("[set-session] setSession error", error.message);
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 400 }
        );
      }
      return res;
    }

    console.warn("[set-session] bad request payload", body);
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  } catch (e: any) {
    console.error("[set-session] exception", e?.message || e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "server_error" },
      { status: 500 }
    );
  }
}