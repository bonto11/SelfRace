// src/app/api/auth/whoami/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const idRaw = cookieStore.get("sr_id")?.value ?? null;
    const uuid = cookieStore.get("sr_uuid")?.value ?? null;
    const idNum = Number.isFinite(Number(idRaw)) ? Number(idRaw) : null;

    const sb = await getSupabaseServer();
    const { data, error } = await sb.auth.getUser();

    if (error) {
      console.error("[WHOAMI][srv] auth error:", error.message);
    }

    const authUser = data?.user ?? null;
    const authId = authUser?.id ?? null;
    const authEmail = (authUser?.email ?? null) as string | null;

    // --- profil z tabuľky users (display_name, mail_address) ---
    let profileName: string | null = null;
    let profileEmail: string | null = null;

    if (authId) {
      const { data: profile, error: profileErr } = await sb
        .from("users")
        .select("display_name, name, mail_address")
        .eq("auth_uid", authId) // ak používaš iný stĺpec, zmeň tu
        .maybeSingle();

      if (profileErr) {
        console.error("[WHOAMI][srv] profile error:", profileErr.message);
      }

      if (profile) {
        profileName =
          (profile.display_name as string | null) ??
          (profile.name as string | null) ??
          null;
        profileEmail =
          (profile.mail_address as string | null) ?? authEmail ?? null;
      }
    }

    const name =
      profileName ??
      ((authUser?.user_metadata as any)?.full_name as string | null) ??
      authEmail ??
      null;

    const email = profileEmail ?? authEmail ?? "";

    const user = {
      name: name ?? "",
      email: email ?? "",
      avatarUrl: null as string | null,
    };

    return NextResponse.json(
      {
        ok: true,
        user,
        whoami: { id: idNum, uuid, authId },
      },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      }
    );
  } catch (e: any) {
    console.error("[WHOAMI][srv] ERROR:", e?.message ?? e);
    return NextResponse.json(
      {
        ok: false,
        user: null,
        whoami: { id: null, uuid: null, authId: null },
        error: e?.message ?? "err",
      },
      { status: 200 }
    );
  }
}