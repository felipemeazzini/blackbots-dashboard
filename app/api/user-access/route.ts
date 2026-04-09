import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_access")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const { user_id, email } = await req.json();
  if (!user_id || !email) {
    return NextResponse.json({ error: "user_id and email required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_access")
    .upsert(
      { user_id, email, status: "pending", updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
