// src/app/api/auth/set-session/route.ts
import { NextRequest, NextResponse, type CookieOptions } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Session } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "sr_uidn";
const cookieOpts: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30, // 30 dní
};

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  // klient pre route (vie zapisovať cookies do `res`)
  const supabase = createRouteHandlerClient({ cookies: () => req.cookies });

  const body = await req.json().catch(() => ({}));
  const event: string = body?.event ?? "";
  const session: Session | null = body?.session ?? null;

  // helper na zápis/mazanie nášho cookie
  const setSrUid = (val: string | null) => {
    if (!val && req.cookies.get(COOKIE_NAME)) {
      res.cookies.delete(COOKIE_NAME);
      return;
    }
    if (val) {
      res.cookies.set(COOKIE_NAME, val, cookieOpts);
    }
  };

  try {
    if (event === "SIGNED_OUT") {
      // vymaž auth cookies aj náš sr_uidn
      await supabase.auth.signOut();
      setSrUid(null);
      return res;
    }

    if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
      // zapíš auth session do HttpOnly cookies (helpers to urobia cez getSession/setSession)
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      // 1× z DB vytiahni interné ID a ulož do nášho cookie `sr_uidn`
      const authUid = session.user.id;
      const { data, error } = await supabase
        .from("users")               // 👈 názov tabuľky
        .select("id")
        .eq("uid", authUid)          // 👈 stĺpec s supabase UUID
        .maybeSingle();

      if (error) {
        console.error("[set-session] users fetch error:", error.message);
        setSrUid(null);
      } else {
        const num = typeof data?.id === "number" ? data!.id : Number(data?.id);
        if (Number.isFinite(num)) setSrUid(String(num));
        else setSrUid(null);
      }

      return res;
    }

    // fallback (napr. refresh)
    await supabase.auth.getSession();
    return res;
  } catch (e: any) {
    console.error("[set-session] ERROR:", e?.message ?? e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}