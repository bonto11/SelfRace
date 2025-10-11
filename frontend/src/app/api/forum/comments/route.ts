// src/app/api/forum/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/shared/utils/supabaseServer";
import { createCommentSchema } from "@/features/forum/validation";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await req.json();
  const parsed = createCommentSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

  const { data, error } = await supabase
    .from("forum_comments")
    .insert({
      author_id: user.id,
      question_id: parsed.data.question_id,
      body_markdown: parsed.data.body_markdown,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
