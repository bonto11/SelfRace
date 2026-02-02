// src/app/api/auth/set-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";
import { SUPABASE_URL,SUPABASE_ANON_KEY, NODE_ENV } from "@/app/shared/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serverClient(req: NextRequest, res: NextResponse) {
  return createServerClient(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
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
    },
  );
}

type Body = { event?: "SIGNED_IN" | "SIGNED_OUT"; session?: Session | null };

const SR_UUID = "sr_uuid"; // app users.auth_uid
const SR_ID = "sr_id";     // app users.id

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 dní
};

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const supabase = serverClient(req, res);

  try {
    const body = ((await req.json().catch(() => ({}))) ?? {}) as Body;
    const event = body?.event ?? "";
    const session = body?.session ?? null;

    // SIGN OUT – Supabase + naše cookies
    if (event === "SIGNED_OUT") {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      res.cookies.delete(SR_UUID);
      res.cookies.delete(SR_ID);
      return res;
    }

    // SIGN IN – nastavíme Supabase session + zosynchronizujeme profil
    if (event === "SIGNED_IN" && session?.access_token && session?.refresh_token) {
      // 1) nastaviť Supabase session (httpOnly cookies)
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      const authUser = session.user;
      const authUid = authUser?.id ?? null;
      const email = authUser?.email ?? null;
      const fullName =
        (authUser?.user_metadata as any)?.full_name ??
        (authUser?.user_metadata as any)?.name ??
        null;

      if (!authUid || !email) {
        console.warn("[SET-SESSION] missing authUid or email, cannot sync profile");
        res.cookies.delete(SR_UUID);
        res.cookies.delete(SR_ID);
        return res;
      }

      // 2) sync do public.users cez RPC
      const { data: dbUser, error: rpcError } = await supabase.rpc(
        "app_sync_user_profile",
        {
          p_auth_uid: authUid,
          p_email: email,
          p_display_name: fullName,
        },
      );

      if (rpcError || !dbUser) {
        console.error(
          "[SET-SESSION] app_sync_user_profile error:",
          rpcError?.message ?? "no data",
        );
        // radšej nemať žiadne ID ako zlé
        res.cookies.delete(SR_UUID);
        res.cookies.delete(SR_ID);
        return res;
      }

      // očakávame, že funkcia vráti riadok z public.users
      const appId: number | null = dbUser.id ?? null;
      res.cookies.set(SR_UUID, authUid, {...cookieOpts,
        httpOnly: false
      });

      //const appUuid: string | null = dbUser.user_uid ?? null;

      if (appId != null) {
        res.cookies.set(SR_ID, String(appId), cookieOpts);
      }

      //if (appUuid) {
      //  res.cookies.set(SR_UUID, appUuid, cookieOpts);
     // }

      return res;
    }

    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (e: any) {
    console.error("[SET-SESSION] ERROR:", e?.message ?? e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}