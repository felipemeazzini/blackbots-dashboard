import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account_id");
  const campaignId = searchParams.get("campaign_id");

  if (!accountId) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("campaign_goals")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true });

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

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
    const {
      account_id,
      campaign_id,
      adset_id,
      level = "campaign",
      metric,
      goal_value,
      min_purchases_threshold = 3,
      warning_threshold_pct = 0.3,
      critical_threshold_pct = 0.6,
    } = body;

    if (!account_id || !metric || goal_value === undefined) {
      return NextResponse.json(
        { error: "account_id, metric, and goal_value are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("campaign_goals")
      .upsert(
        {
          account_id,
          campaign_id: campaign_id || null,
          adset_id: adset_id || null,
          level,
          metric,
          goal_value,
          min_purchases_threshold,
          warning_threshold_pct,
          critical_threshold_pct,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_id,campaign_id,adset_id,metric" }
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

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("campaign_goals").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
