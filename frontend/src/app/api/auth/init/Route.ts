// src/app/api/auth/init/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export function GET() {
  const c = cookies().get("sr_uidn")?.value ?? null;
  const id = c ? Number(c) : null;
  const userId = Number.isFinite(id!) ? id : null;
  return NextResponse.json({ success: true, userId });
}