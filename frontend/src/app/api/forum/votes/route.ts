// src/app/api/forum/votes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/shared/utils/supabaseServer";
import { voteSchema } from "@/features/forum/validation";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await req.json();
  const parsed = voteSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

  const { error } = await supabase
    .from("forum_comment_votes")
    .upsert({
      comment_id: parsed.data.comment_id,
      voter_id: user.id,
      value: parsed.data.value,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
