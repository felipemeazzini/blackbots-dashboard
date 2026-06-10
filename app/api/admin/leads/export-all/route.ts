import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin-auth";
import { buildCompleteXlsx, SavedLead } from "@/lib/leads-source/xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RawLeadRow {
  list_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  tier: SavedLead["tier"];
  score: number | null;
  signup_at: string | null;
  months_active: number | null;
  total_paid_brl: number | null;
  currently_active: boolean | null;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // 1. Lista de nomes (pra mostrar na coluna outras_listas)
  const { data: lists, error: listsErr } = await supabase
    .from("lead_lists")
    .select("id, name");
  if (listsErr) return NextResponse.json({ error: listsErr.message }, { status: 500 });
  const listNameById = new Map((lists || []).map((l) => [l.id, l.name as string]));

  // 2. Pagina todos os leads, de todas as listas
  const PAGE = 1000;
  const all: RawLeadRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("leads")
      .select("list_id, name, email, phone, tier, score, signup_at, months_active, total_paid_brl, currently_active")
      .order("score", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    all.push(...(data as RawLeadRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (all.length === 0) {
    return NextResponse.json({ error: "Base vazia (nenhum lead em nenhuma lista)" }, { status: 400 });
  }

  // 3. Dedup por (email, phone). Mantem a versao com maior score; acumula os nomes das listas.
  const deduped = new Map<string, { lead: RawLeadRow; listNames: Set<string> }>();
  for (const r of all) {
    const key = `${(r.email || "").toLowerCase()}|${r.phone || ""}`;
    let entry = deduped.get(key);
    if (!entry) {
      entry = { lead: r, listNames: new Set() };
      deduped.set(key, entry);
    } else if ((r.score ?? 0) > (entry.lead.score ?? 0)) {
      entry.lead = r;
    }
    const listName = listNameById.get(r.list_id);
    if (listName) entry.listNames.add(listName);
  }

  // 4. Monta SavedLead[] com appeared_in_lists = TODAS as listas onde o lead aparece
  const leads: SavedLead[] = Array.from(deduped.values()).map(({ lead, listNames }) => ({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    tier: lead.tier,
    score: lead.score,
    signup_at: lead.signup_at,
    months_active: lead.months_active,
    total_paid_brl: lead.total_paid_brl,
    currently_active: lead.currently_active,
    appeared_in_lists: Array.from(listNames).sort(),
  }));

  const buf = buildCompleteXlsx(leads);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="base-completa.xlsx"`,
      "Content-Length": String(buf.length),
    },
  });
}
