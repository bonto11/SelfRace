//src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serverClient(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          res.cookies.set(name, value, options as any);
        },
        remove: (name: string) => {
          res.cookies.delete(name);
        },
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true, user: null as any });
  const sb = serverClient(req, res);

  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });

  const meta = (data.user.user_metadata as Record<string, any>) || {};
  const user = {
    email: data.user.email ?? "",
    name: meta.full_name ?? meta.name ?? "",
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
  };

  return NextResponse.json({ ok: true, user });
}