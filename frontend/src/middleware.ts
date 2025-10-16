// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  try {
    console.log('[SB][mw] start', { path: req.nextUrl.pathname });
    const supabase = createMiddlewareClient({ req, res });

    const { data, error } = await supabase.auth.getSession();
    console.log('[SB][mw] getSession()', {
      path: req.nextUrl.pathname,
      hasSession: !!data?.session,
      userId: data?.session?.user?.id ?? null,
      error: error?.message ?? null,
    });
  } catch (e: any) {
    console.error('[SB][mw] ERROR', e?.message ?? e);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
