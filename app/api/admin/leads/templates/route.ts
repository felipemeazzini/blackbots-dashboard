import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin, getUserEmail } from "@/lib/admin-auth";
import { getPreset } from "@/lib/leads-source/presets";
import { ALL_TIERS, Tier } from "@/lib/leads-source/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  preset_key: string;
  preset_params: Record<string, unknown>;
  tier_filter: Tier[];
  schedule_days: number;
  last_run_at: string | null;
  last_list_id: string | null;
  created_by_email: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("lead_list_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const enriched = (data || []).map((t: TemplateRow) => {
    const lastTs = t.last_run_at ? new Date(t.last_run_at).getTime() : null;
    const elapsedDays = lastTs ? (now - lastTs) / 86400000 : null;
    const is_overdue = elapsedDays === null ? true : elapsedDays >= t.schedule_days;
    return { ...t, is_overdue, days_since_run: elapsedDays !== null ? Math.floor(elapsedDays) : null };
  });

  return NextResponse.json({ data: enriched });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const userEmail = getUserEmail(req)!;
  const body = await req.json().catch(() => ({}));
  const { name, description, preset_key, params, tier_filter, schedule_days } = body as {
    name?: string;
    description?: string;
    preset_key?: string;
    params?: Record<string, unknown>;
    tier_filter?: Tier[];
    schedule_days?: number;
  };

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "name obrigatorio" }, { status: 400 });
  }
  if (!preset_key || !getPreset(preset_key)) {
    return NextResponse.json({ error: "preset_key invalido" }, { status: 400 });
  }
  const days = Number(schedule_days);
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: "schedule_days deve estar entre 1 e 365" }, { status: 400 });
  }

  const tiers: Tier[] = Array.isArray(tier_filter) && tier_filter.length > 0
    ? tier_filter.filter((t): t is Tier => ALL_TIERS.includes(t))
    : ALL_TIERS;

  const { data, error } = await supabase
    .from("lead_list_templates")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      preset_key,
      preset_params: params || {},
      tier_filter: tiers,
      schedule_days: days,
      created_by_email: userEmail,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Falha ao criar template" }, { status: 500 });
  }

  return NextResponse.json({ data });
}
