// src/app/api/auth/signout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serverClient(req: NextRequest, res: NextResponse) {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(URL, ANON, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set(name, value, options as any);
      },
      remove(name: string) {
        res.cookies.delete(name);
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true }); // budeme doň zapisovať cookies
  const supabase = serverClient(req, res);

  try {
    // zmaž Supabase httpOnly cookies (auth)
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  // zmaž aj tvoje identifikátory
  res.cookies.delete("sr_uuid");
  res.cookies.delete("sr_id");

  return res;
}