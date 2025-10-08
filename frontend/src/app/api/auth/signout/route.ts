// src/app/api/signout/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function serverClient(req: NextRequest, res: NextResponse) {
  return createServerClient(URL, ANON, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        res.cookies.set(name, value, options as any);
      },
      remove(name: string) {
        res.cookies.delete(name);
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const sb = serverClient(req, res);
  await sb.auth.signOut();
  return res;
}
