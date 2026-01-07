// src/app/api/auth/session-token/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = await getSupabaseServer();
    const { data, error } = await sb.auth.getSession();

    if (error) {
      console.error("[AUTH][session-token] getSession error:", error.message);
      return NextResponse.json(
        { access_token: null, refresh_token: null, error: error.message },
        { status: 401, headers: { "cache-control": "no-store" } }
      );
    }

    if (!data?.session) {
      return NextResponse.json(
        { access_token: null, refresh_token: null },
        { status: 401, headers: { "cache-control": "no-store" } }
      );
    }

    const { access_token, refresh_token } = data.session;

    return NextResponse.json(
      { access_token, refresh_token },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    console.error("[AUTH][session-token] exception:", e?.message ?? e);
    return NextResponse.json(
      { access_token: null, refresh_token: null, error: "server_error" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}