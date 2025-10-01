// src/app/api/signout/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/shared/utils/supabaseServer";

export async function POST() {
  try {
    const supabase = getSupabaseServer();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}