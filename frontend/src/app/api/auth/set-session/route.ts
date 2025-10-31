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

const SR_UUID = "sr_uuid";
const SR_ID = "sr_id";

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const supabase = serverClient(req, res);

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const event = body?.event ?? "";
    const session = body?.session ?? null;

    // 🔴 SIGN OUT
    if (event === "SIGNED_OUT") {
      // 1) Supabase logout
      await supabase.auth.signOut();

      // 2) Vymaž vlastné cookies
      const exp = new Date(0);
      res.cookies.set({ name: SR_UUID, value: "", expires: exp, path: "/" });
      res.cookies.set({ name: SR_ID, value: "", expires: exp, path: "/" });

      // 3) Povedz browseru nech zmaže cache, cookies a storage
      res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

      return res;
    }

    // 🟢 SIGN IN
    if (
      event === "SIGNED_IN" &&
      session?.access_token &&
      session?.refresh_token
    ) {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      const uuid = session.user?.id ?? null;
      if (uuid) res.cookies.set(SR_UUID, uuid, cookieOpts);

      if (uuid) {
        const { data: userRow } = await supabase
          .from("users")
          .select("id")
          .eq("user_uid", uuid)
          .single();

        if (userRow?.id != null) {
          res.cookies.set(SR_ID, String(userRow.id), cookieOpts);
        }
      }

      return res;
    }

    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (e: any) {
    console.error("set-session error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}