// src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // DÔLEŽITÉ: await cookies()
    const cookieStore = await cookies();
    const idRaw = cookieStore.get("sr_id")?.value ?? null;
    const uuidCookie = cookieStore.get("sr_uuid")?.value ?? null;

    const idNum = Number.isFinite(Number(idRaw)) ? Number(idRaw) : null;

    const sb = await getSupabaseServer();
    const { data: authData, error: authError } = await sb.auth.getUser();

    if (authError) {
      console.error("[ME][srv] auth.getUser error:", authError.message);
    }

    const authUser = authData?.user ?? null;
    const email = authUser?.email ?? null;

    // --- profil v tabuľke users ---
    let profileName: string | null = null;
    let profileDisplayName: string | null = null;

    if (idNum != null) {
      const { data: profile, error: profileError } = await sb
        .from("users")
        .select("name, display_name")
        .eq("id", idNum)
        .maybeSingle();

      if (profileError) {
        console.error("[ME][srv] users select error:", profileError.message);
      } else if (profile) {
        profileName = (profile as any).name ?? null;
        profileDisplayName = (profile as any).display_name ?? null;
      }
    }

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
      id: idNum,
      uuid: uuidCookie,
      email,
      name,        // celé meno
      displayName, // prezývka / skratka
      avatarUrl,
    };

    return NextResponse.json(
      { ok: true, user },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      }
    );
  } catch (e: any) {
    console.error("[ME][srv] ERROR:", e?.message ?? e);
    return NextResponse.json(
      { ok: false, user: null, error: e?.message ?? "server_error" },
      { status: 200 }
    );
  }
}