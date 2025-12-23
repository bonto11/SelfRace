// src/app/api/auth/session/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = await getSupabaseServer();
    const { data, error } = await sb.auth.getUser();

    if (error) {
      console.error("[SB][session] error:", error.message);
      return NextResponse.json(
        { user: null, error: error.message },
        { status: 401 }
      );
    }

    if (!data?.user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    console.log("[SB][session] user ok:", data.user.email);
    return NextResponse.json({ user: data.user });
  } catch (e: any) {
    console.error("[SB][session] exception:", e.message ?? e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
