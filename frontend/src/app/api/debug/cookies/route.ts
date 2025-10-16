// src/app/api/debug/cookies/route.ts
import { NextResponse, NextRequest } from "next/server";
import { getSupabaseServer } from "@/shared/utils/supabaseServer";

export async function GET(req: NextRequest) {
  const sb = getSupabaseServer();
  const { data } = await sb.auth.getUser();
  const names = req.cookies.getAll().map((c) => c.name);
  console.log("[/api/debug/cookies] cookie names:", names);
  return NextResponse.json({ cookieNames: names, userId: data.user?.id ?? null });
}
