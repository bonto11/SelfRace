// src/app/api/auth/whoami/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const idRaw = cookieStore.get("sr_id")?.value ?? null;
    const uuid  = cookieStore.get("sr_uuid")?.value ?? null;

    const idNum = Number.isFinite(Number(idRaw)) ? Number(idRaw) : null;

    const payload = { id: idNum, uuid };

    return NextResponse.json(payload, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (e: any) {
    console.error("[WHOAMI][srv] ERROR:", e?.message ?? e);
    return NextResponse.json({ id: null, uuid: null, error: e?.message ?? "err" }, { status: 200 });
  }
}

