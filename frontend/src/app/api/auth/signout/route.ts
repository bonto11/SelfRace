// src/app/api/auth/signout/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/shared/utils/supabaseServer";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const sb = getSupabaseServer();

  await sb.auth.signOut();

  res.cookies.delete("sr_uuid");
  res.cookies.delete("sr_id");

  return res;
}
