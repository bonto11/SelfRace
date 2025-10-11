// src/app/api/forum/questions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/shared/utils/supabaseServer";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();

  const { data: q, error: eQ } = await supabase
    .from("forum_questions")
    .select("*")
    .eq("id", params.id)
    .eq("is_deleted", false)
    .single();

  if (eQ || !q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: comments } = await supabase
    .from("forum_comments")
    .select("*")
    .eq("question_id", params.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  const ids = (comments ?? []).map((c) => c.id);
  const byComment: Record<string, { AGREE: number; PARTIAL: number; MISLEADING: number }> = {};
  ids.forEach((id) => (byComment[id] = { AGREE: 0, PARTIAL: 0, MISLEADING: 0 }));

  if (ids.length) {
    const { data: votes } = await supabase
      .from("forum_comment_votes")
      .select("*")
      .in("comment_id", ids);

    (votes ?? []).forEach((v: any) => {
      byComment[v.comment_id][v.value as "AGREE" | "PARTIAL" | "MISLEADING"]++;
    });
  }

  return NextResponse.json({
    question: q,
    comments: (comments ?? []).map((c) => ({ ...c, votes: byComment[c.id] })),
  });
}
