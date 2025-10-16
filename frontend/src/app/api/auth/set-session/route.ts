// src/(auth)/api/auth/set-session/route.ts

import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true });
}

/*
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerWritable } from "@/shared/utils/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sb = getSupabaseServerWritable();

  const body = await req.json().catch(() => ({} as any));
  const event = body?.event as string | undefined;
  const session = body?.session;

  if (event === "SIGNED_OUT") {
    await sb.auth.signOut(); // vyčistí cookies
    return NextResponse.json({ ok: true });
  }

  if (event === "SIGNED_IN") {
    if (!session?.access_token || !session?.refresh_token) {
      return new NextResponse(null, { status: 204 });
    }
    const { error } = await sb.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
}
*/