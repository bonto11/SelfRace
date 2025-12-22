// src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const idRaw = cookieStore.get("sr_id")?.value ?? null;
    const uuidCookie = cookieStore.get("sr_uuid")?.value ?? null;

    const idNum = Number.isFinite(Number(idRaw)) ? Number(idRaw) : null;

    const sb = await getSupabaseServer();

    type DbUser = {
      id: number;
      user_uid?: string | null;
      auth_uid?: string | null;
      email?: string | null;
      display_name?: string | null;
    };

    let user: {
      id: number | null;
      uuid: string | null;
      email: string | null;
      name: string | null;
      avatarUrl: string | null;
    } | null = null;

    // 1) pokus z vlastnej users tabuľky
    try {
      let dbUser: DbUser | null = null;

      if (idNum != null) {
        const { data, error } = await sb
          .from("users")
          .select("id, user_uid, auth_uid, email, display_name")
          .eq("id", idNum)
          .maybeSingle();

        if (!error && data) {
          dbUser = data as DbUser;
        } else if (error) {
          console.error("[ME][srv] users by id error:", error.message ?? error);
        }
      } else if (uuidCookie) {
        const { data, error } = await sb
          .from("users")
          .select("id, user_uid, auth_uid, email, display_name")
          .eq("user_uid", uuidCookie)
          .maybeSingle();

        if (!error && data) {
          dbUser = data as DbUser;
        } else if (error) {
          console.error(
            "[ME][srv] users by user_uid error:",
            error.message ?? error
          );
        }
      }

      if (dbUser) {
        user = {
          id: dbUser.id ?? idNum,
          uuid: dbUser.user_uid ?? uuidCookie ?? dbUser.auth_uid ?? null,
          email: dbUser.email ?? null,
          name:
            dbUser.display_name ??
            dbUser.email ??
            null,
          avatarUrl: null,
        };
      }
    } catch (e: any) {
      console.error("[ME][srv] users table lookup ERROR:", e?.message ?? e);
    }

    // 2) fallback na supabase auth.getUser(), ak nič v users
    if (!user) {
      try {
        const { data, error } = await sb.auth.getUser();

        if (error) {
          console.error("[ME][srv] auth.getUser error:", error.message ?? error);
        } else if (data?.user) {
          const u = data.user;
          const meta = (u.user_metadata || {}) as any;

          user = {
            id: idNum,
            uuid: uuidCookie ?? (u.id as string),
            email: u.email ?? null,
            name:
              meta.full_name ??
              meta.name ??
              meta.display_name ??
              u.email ??
              null,
            avatarUrl:
              meta.avatar_url ??
              meta.picture ??
              null,
          };
        }
      } catch (e: any) {
        console.error("[ME][srv] auth.getUser fallback ERROR:", e?.message ?? e);
      }
    }

    // 3) žiadny user – stále vrátime 200, len ok:false
    if (!user) {
      return NextResponse.json(
        { ok: false, user: null },
        { status: 200, headers: { "cache-control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, user },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    console.error("[ME][srv] FATAL ERROR:", e?.message ?? e);
    return NextResponse.json(
      {
        ok: false,
        user: null,
        error: e?.message ?? "unexpected_error",
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  }
}