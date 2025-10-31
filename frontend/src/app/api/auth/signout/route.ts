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
      get(name: string) { return req.cookies.get(name)?.value; },
      set(name: string, value: string, options: CookieOptions) { res.cookies.set(name, value, options as any); },
      remove(name: string) { res.cookies.delete(name); },
    },
  });
}

export async function POST(req: NextRequest) {
  // budeme doň zapisovať cookies a hlavičky
  const res = NextResponse.json({ ok: true });

  const supabase = serverClient(req, res);
  try {
    // zmaž tvoje identifikátory (pre istotu ich aj expíruj)
    const exp = new Date(0);
    res.cookies.set({ name: "sr_uuid", value: "", expires: exp, path: "/" });
    res.cookies.set({ name: "sr_id",   value: "", expires: exp, path: "/" });

    // zmaž Supabase httpOnly cookies (auth)
    await supabase.auth.signOut();

    // nech browser vyčistí cache + cookies + storage (funguje na HTTPS)
    res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.headers.set("Pragma", "no-cache");
  } catch {
    // ignore
  }
  return res;
}