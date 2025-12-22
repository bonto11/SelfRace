// src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, test: "me route works" });
}