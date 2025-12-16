// src/app/api/auth/init/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const c = cookieStore.get("sr_uidn")?.value ?? null;
  const id = c ? Number(c) : null;
  const userId = Number.isFinite(id!) ? id : null;
  return NextResponse.json({ success: true, userId });
}