// src/app/api/forum/questions/list/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/shared/utils/supabaseServer";

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("forum_questions")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
