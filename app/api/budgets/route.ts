import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account_id");
  const month = searchParams.get("month");

  if (!accountId) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  try {
    const supabase = createServerClient();
    let query = supabase.from("account_budgets").select("*").eq("account_id", accountId);
    if (month) query = query.eq("month", month);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { account_id, month, budget_amount } = body;

    if (!account_id || !month || budget_amount === undefined) {
      return NextResponse.json({ error: "account_id, month, and budget_amount are required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("account_budgets")
      .upsert(
        { account_id, month, budget_amount, updated_at: new Date().toISOString() },
        { onConflict: "account_id,month" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
