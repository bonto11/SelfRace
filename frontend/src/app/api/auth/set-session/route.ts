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

// univerzálne options pre naše "app" cookies
const appCookieOpts: CookieOptions = {
  httpOnly: false,                      // nech to vie čítať aj klient
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,           // 30 dní
};

type Body = { event?: "SIGNED_IN" | "SIGNED_OUT"; session?: Session };

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { event, session } = body ?? {};

  // do tejto odpovede sa budú zapisovať cookies
  const res = NextResponse.json({ ok: true });
  const supabase = serverClient(req, res);

  try {
    if (event === "SIGNED_OUT") {
      console.log("[SB][set-session] signOut -> clearing cookies");
      // zmaž supabase cookies
      await supabase.auth.signOut();
      // zmaž aj naše app cookies
      res.cookies.delete("sr_uuid");
      res.cookies.delete("sr_id");
      return res;
    }

    if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
      console.log("[SB][set-session] → SIGNED_IN handler");
      const { error: setErr } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (setErr) {
        console.error("[SB][set-session] setSession ERROR", setErr.message);
        return NextResponse.json({ ok: false, error: setErr.message }, { status: 500 });
      }

      const uuid = session.user?.id ?? null;
      console.log("[SB][set-session] session.user.id =", uuid);

      if (uuid) {
        res.cookies.set("sr_uuid", uuid, appCookieOpts);

        const { data: userRow, error: qErr } = await supabase
          .from("users")
          .select("id")
          .eq("user_uid", uuid)
          .single();

        console.log("[SB][set-session] users query result", { userRow, qErr });

        if (qErr) {
          console.warn("[SB][set-session] users lookup ERROR:", qErr.message);
        } else if (userRow?.id != null) {
          res.cookies.set("sr_id", String(userRow.id), appCookieOpts);
          console.log("[SB][set-session] ✅ sr_id set =", userRow.id);
        } else {
          console.warn("[SB][set-session] userRow empty, no sr_id cookie set");
        }
      } else {
        console.warn("[SB][set-session] ⚠️ session.user.id is missing");
      }

      return res;
    }

    console.log("[SB][set-session] invalid payload", { hasSession: !!session });
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  } catch (e: any) {
    console.error("[SB][set-session] ERROR", e?.message ?? e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}