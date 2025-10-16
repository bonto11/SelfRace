//src/app/api/debug/session/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/shared/utils/supabaseServer';

export async function GET() {
  const sb = getSupabaseServer();
  const { data, error } = await sb.auth.getSession();

  const payload = {
    ok: !error,
    hasSession: !!data?.session,
    userId: data?.session?.user?.id ?? null,
    error: error?.message ?? null,
  };

  console.log('[SB][debug-route] /api/debug/session →', payload);
  return NextResponse.json(payload);
}
