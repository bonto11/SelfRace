// src/app/api/auth/set-session/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serverClient(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          res.cookies.set(name, value, options);
        },
        remove: (name: string) => {
          res.cookies.delete(name);
        },
      },
    }
  );
}

type Body = { event?: "SIGNED_IN" | "SIGNED_OUT"; session?: Session | null };

const SR_UUID = "sr_uuid"; // string (supabase user.id)
const SR_ID   = "sr_id";   // number  (náš interný users.id)

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 dní
};

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true, step: "init" });
  const supabase = serverClient(req, res);

  let debug: Record<string, any> = { step: "start" };

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const event = body?.event ?? "";
    const session = body?.session ?? null;

    debug.event = event;
    debug.hasSessionInBody = !!session;

    // SIGN OUT: vyčistenie cookies cez supabase clienta
    if (event === "SIGNED_OUT") {
      await supabase.auth.signOut();
      res.headers.set("x-sr-debug", JSON.stringify({ ...debug, signout: true }));
      return res;
    }

    // SIGN IN: uloženie supabase session do httpOnly cookies
    if (
      event === "SIGNED_IN" &&
      session?.access_token &&
      session?.refresh_token
    ) {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      debug.setSessionOk = !setErr;
      if (setErr) {
        debug.setSessionError = setErr.message;
        return NextResponse.json({ ok: false, debug }, { status: 500 });
      }

      // 1) zapíš sr_uuid
      const uuid = session.user?.id ?? null;
      if (uuid) {
        res.cookies.set(SR_UUID, uuid, cookieOpts);
      }
      debug.uuid = !!uuid;

      // 2) dotiahni náš numerický user.id a zapíš sr_id
      //    POZOR: stĺpec je u teba 'user_uid'
      if (uuid) {
        const { data: userRow, error: qErr } = await supabase
          .from("users")
          .select("id")
          .eq("user_uid", uuid)
          .single();

        debug.selectOk = !qErr;
        if (qErr) {
          debug.selectError = qErr.message;
        } else if (userRow?.id != null) {
          res.cookies.set(SR_ID, String(userRow.id), cookieOpts);
          debug.wroteSrId = true;
          debug.srId = userRow.id;
        } else {
          debug.wroteSrId = false;
        }
      }

      res.headers.set("x-sr-debug", JSON.stringify(debug));
      return res; // obsahuje Set-Cookie
    }

    debug.invalidPayload = true;
    return NextResponse.json({ ok: false, debug }, { status: 400 });
  } catch (e: any) {
    debug.catch = e?.message ?? String(e);
    return NextResponse.json({ ok: false, debug }, { status: 500 });
  }
}