import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin-auth";
import { lookupCrossLists } from "@/lib/leads-source/crossLists";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(500, Math.max(10, Number(searchParams.get("page_size")) || 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: list, error: listErr } = await supabase
    .from("lead_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (listErr || !list) {
    return NextResponse.json({ error: "Lista nao encontrada" }, { status: 404 });
  }

  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, name, email, phone, source_id, created_at, score, tier, months_active, total_paid_brl, last_paid_at, currently_active, signup_at")
    .eq("list_id", id)
    .order("score", { ascending: false })
    .range(from, to);

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });

  // Cross-list lookup: pra cada lead da pagina, quais outras listas tem o mesmo email/phone
  const crossMap = await lookupCrossLists(id, (leads || []).map((l) => ({ id: l.id, email: l.email, phone: l.phone })));
  const enrichedLeads = (leads || []).map((l) => ({
    ...l,
    appeared_in_lists: crossMap.get(l.id) || [],
  }));

  return NextResponse.json({ data: { list, leads: enrichedLeads, page, pageSize } });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { error } = await supabase.from("lead_lists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
