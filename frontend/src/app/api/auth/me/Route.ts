// src/app/api/auth/me/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbUserRow = {
  id: number;
  user_uid?: string | null;
  display_name?: string | null;
  name?: string | null;
  email?: string | null;
  mail_address?: string | null;
  avatar_url?: string | null;
};

export async function GET() {
  try {
    const cookieStore = cookies();
    const idRaw = cookieStore.get("sr_id")?.value ?? null;
    const uuidCookie = cookieStore.get("sr_uuid")?.value ?? null;

    const sb = await getSupabaseServer();

    let profile: DbUserRow | null = null;

    // 1) users podľa user_uid z cookie (preferované)
    if (uuidCookie) {
      const { data, error } = await sb
        .from("users")
        .select(
          "id, user_uid, display_name, name, email, mail_address, avatar_url"
        )
        .eq("user_uid", uuidCookie)
        .maybeSingle();

      if (error) {
        console.error("[ME] users by user_uid error:", error.message);
      } else if (data) {
        profile = data as DbUserRow;
      }
    }

    // 2) fallback: users podľa číselného id z cookie
    if (!profile && idRaw && Number.isFinite(Number(idRaw))) {
      const idNum = Number(idRaw);
      const { data, error } = await sb
        .from("users")
        .select(
          "id, user_uid, display_name, name, email, mail_address, avatar_url"
        )
        .eq("id", idNum)
        .maybeSingle();

      if (error) {
        console.error("[ME] users by id error:", error.message);
      } else if (data) {
        profile = data as DbUserRow;
      }
    }

    // 3) fallback: auth.getUser (napr. ak users nemá záznam)
    if (!profile) {
      const { data: authData, error: authError } = await sb.auth.getUser();
      if (authError) {
        console.error("[ME] auth.getUser error:", authError.message);
      } else if (authData?.user) {
        const u = authData.user;
        profile = {
          id: 0,
          user_uid: u.id,
          display_name: (u.user_metadata as any)?.display_name ?? null,
          name: (u.user_metadata as any)?.name ?? null,
          email: u.email ?? null,
          mail_address: null,
          avatar_url: (u.user_metadata as any)?.avatar_url ?? null,
        };
      }
    }

    if (!profile) {
      return NextResponse.json(
        { ok: false, user: null, error: "not_authenticated" },
        { status: 401 }
      );
    }

    const name =
      profile.display_name ||
      profile.name ||
      profile.email ||
      profile.mail_address ||
      "";

    const email = profile.email ?? profile.mail_address ?? null;
    const avatarUrl = profile.avatar_url ?? null;

    const payload = {
      ok: true,
      user: {
        id: profile.id,
        uuid: profile.user_uid ?? uuidCookie ?? null,
        email,
        name,
        avatarUrl,
      },
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (e: any) {
    console.error("[ME] server ERROR:", e?.message ?? e);
    return NextResponse.json(
      { ok: false, user: null, error: "server_error" },
      { status: 500 }
    );
  }
}