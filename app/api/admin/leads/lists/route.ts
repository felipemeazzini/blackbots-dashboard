import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin, getUserEmail } from "@/lib/admin-auth";
import { createLeadList, CreateListError } from "@/lib/leads-source/createList";
import { Tier } from "@/lib/leads-source/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("lead_lists")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const userEmail = getUserEmail(req)!;
  const body = await req.json().catch(() => ({}));
  const { name, description, preset_key, params, tier_filter, since, until } = body as {
    name?: string;
    description?: string;
    preset_key?: string;
    params?: Record<string, unknown>;
    tier_filter?: Tier[];
    since?: string | null;
    until?: string | null;
  };

  try {
    const result = await createLeadList({
      name: name || "",
      description: description || null,
      preset_key: preset_key || "",
      params: params || {},
      tier_filter,
      since,
      until,
      created_by_email: userEmail,
    });
    return NextResponse.json({ data: result });
  } catch (e) {
    if (e instanceof CreateListError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
