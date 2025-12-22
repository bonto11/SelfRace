// src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = await getSupabaseServer();

    // 1) auth user zo Supabase
    const { data: authData, error: authError } = await sb.auth.getUser();
    if (authError) {
      console.error("[AUTH][me] auth.getUser error:", authError.message);
      return NextResponse.json({ ok: false, user: null }, { status: 200 });
    }

    const authUser = authData?.user;
    if (!authUser) {
      return NextResponse.json({ ok: false, user: null }, { status: 200 });
    }

    // 2) pokus o profil v public.users (pre display_name, mail atď.)
    let profile: any | null = null;
    try {
      const { data: row, error: profErr } = await sb
        .from("users")
        .select(
          "id, user_uid, auth_uid, display_name, name, mail_address, email"
        )
        .eq("auth_uid", authUser.id)
        .maybeSingle();

      if (profErr) {
        console.warn("[AUTH][me] users profile error:", profErr.message);
      } else {
        profile = row ?? null;
      }
    } catch (e: any) {
      console.warn("[AUTH][me] users profile exception:", e?.message ?? e);
    }

    // 3) zloženie mena + emailu
    const profileEmail =
      profile?.mail_address ??
      profile?.email ??
      (authUser.email ?? null);

    const displayName =
      profile?.display_name ??
      profile?.name ??
      (authUser.user_metadata?.full_name ??
        authUser.user_metadata?.name ??
        null);

    const email = profileEmail ?? "";
    const name = displayName ?? email;

    const avatarUrl =
      (authUser.user_metadata as any)?.avatar_url ??
      (authUser.user_metadata as any)?.picture ??
      null;

    const payload = {
      email,
      name,
      avatarUrl,
    };

    return NextResponse.json(
      { ok: true, user: payload },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      }
    );
  } catch (e: any) {
    console.error("[AUTH][me] unexpected ERROR:", e?.message ?? e);
    return NextResponse.json(
      { ok: false, user: null, error: "server_error" },
      { status: 200 }
    );
  }
}