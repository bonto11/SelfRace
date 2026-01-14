// src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const idRaw = cookieStore.get("sr_id")?.value ?? null;      // app users.id (len info)
    const uuidCookie = cookieStore.get("sr_uuid")?.value ?? null; // app users.user_uid

    const idNum = Number.isFinite(Number(idRaw)) ? Number(idRaw) : null;

    const sb = await getSupabaseServer();
    const { data: authData, error: authError } = await sb.auth.getUser();

    if (authError) {
      console.error("[ME][srv] auth.getUser error:", authError.message);
    }

    const authUser = authData?.user ?? null;
    const email = authUser?.email ?? null;
    const authUid = authUser?.id ?? null;

    // --- načítanie profilu z public.users ---
    let profile: any = null;

    if (uuidCookie) {
      const { data, error } = await sb
        .from("users")
        .select("id, user_uid, mail_address, name, display_name")
        .eq("user_uid", uuidCookie)
        .maybeSingle();

      if (error) {
        console.error("[ME][srv] users by user_uid error:", error.message);
      } else {
        profile = data;
      }
    }

    // fallback – staré cookies: skús auth_uid
    if (!profile && authUid) {
      const { data, error } = await sb
        .from("users")
        .select("id, user_uid, mail_address, name, display_name")
        .eq("auth_uid", authUid)
        .maybeSingle();

      if (error) {
        console.error("[ME][srv] users by auth_uid error:", error.message);
      } else {
        profile = data;
      }
    }

    const appId: number | null = profile?.id ?? idNum ?? null;
    const appUuid: string | null = profile?.user_uid ?? uuidCookie ?? null;
    const profileName: string | null = profile?.name ?? null;
    const profileDisplayName: string | null = profile?.display_name ?? null;
    const profileEmail: string | null = profile?.mail_address ?? null;

    const name =
      profileName ??
      (authUser?.user_metadata as any)?.full_name ??
      email;

    const displayName =
      profileDisplayName ??
      profileName ??
      (authUser?.user_metadata as any)?.full_name ??
      email;

    const avatarUrl =
      (authUser?.user_metadata as any)?.avatar_url ??
      (authUser?.user_metadata as any)?.picture ??
      null;

    const user = {
      id: appId,
      uuid: appUuid,
      email: profileEmail ?? email,
      name,
      displayName,
      avatarUrl,
    };

    return NextResponse.json(
      { ok: true, user },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (e: any) {
    console.error("[ME][srv] ERROR:", e?.message ?? e);
    return NextResponse.json(
      { ok: false, user: null, error: e?.message ?? "server_error" },
      { status: 200 },
    );
  }
}