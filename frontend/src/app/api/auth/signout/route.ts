// src/app/api/signout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function compatCookies() {
  const c = cookies();
  return {
    get: (name: string) => c.get(name)?.value,
    set: (name: string, value: string, options?: any) =>
      c.set({ name, value, ...(options ?? {}) }),
    remove: (name: string, options?: any) =>
      c.set({ name, value: "", ...(options ?? {}), maxAge: 0 }),

    getCookie: (name: string) => c.get(name)?.value,
    setCookie: (name: string, value: string, options?: any) =>
      c.set({ name, value, ...(options ?? {}) }),
    removeCookie: (name: string, options?: any) =>
      c.set({ name, value: "", ...(options ?? {}), maxAge: 0 }),
  } as any;
}

function getSb() {
  return createServerClient(URL, ANON, { cookies: compatCookies() });
}

export async function POST() {
  try {
    const sb = getSb();
    await sb.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
