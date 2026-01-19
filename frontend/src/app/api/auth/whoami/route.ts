// src/app/api/auth/whoami/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const idRaw = cookieStore.get("sr_id")?.value ?? null;   // app users.id
    const uuid  = cookieStore.get("sr_uuid")?.value ?? null; // app users.user_uid

    const idNum = Number.isFinite(Number(idRaw)) ? Number(idRaw) : null;

    return NextResponse.json(
      { id: idNum, uuid },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (e: any) {
    console.error("[WHOAMI][srv] ERROR:", e?.message ?? e);
    return NextResponse.json(
      { id: null, uuid: null, error: e?.message ?? "err" },
      { status: 200 },
    );
  }
}