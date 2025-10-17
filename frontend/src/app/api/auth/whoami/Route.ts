// src/app/api/auth/whoami/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const c = cookies();
  const idRaw = c.get("sr_id")?.value ?? null;
  const uuid = c.get("sr_uuid")?.value ?? null;
  const id = idRaw && !Number.isNaN(Number(idRaw)) ? Number(idRaw) : null;
  return NextResponse.json({ id, uuid });
}