// src/app/api/auth/set-session/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function createSb() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const jar = await cookies();
          return jar.get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          const jar = await cookies();
          jar.set(name, value, { ...(options as any), path: "/" } as any);
        },
        async remove(name: string, options: CookieOptions) {
          const jar = await cookies();
          jar.set(name, "", { ...(options as any), path: "/", maxAge: 0 } as any);
        },
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const { access_token, refresh_token } = await req.json().catch(() => ({}));
  const supabase = createSb();

  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
    return NextResponse.json({ ok: true });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}