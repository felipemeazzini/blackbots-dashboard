import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin, getUserEmail } from "@/lib/admin-auth";
import { createLeadList, CreateListError, monthSuffix } from "@/lib/leads-source/createList";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const userEmail = getUserEmail(req)!;
  const { id } = await ctx.params;

  const { data: tpl, error: tplErr } = await supabase
    .from("lead_list_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (tplErr || !tpl) {
    return NextResponse.json({ error: "Template nao encontrado" }, { status: 404 });
  }

  const listName = `${tpl.name} - ${monthSuffix()}`;

  // Extrai filtros de periodo de dentro do preset_params (armazenados com prefixo _)
  const allParams = (tpl.preset_params || {}) as Record<string, unknown>;
  const since = typeof allParams._since === "string" ? allParams._since : null;
  const until = typeof allParams._until === "string" ? allParams._until : null;
  const cleanParams: Record<string, unknown> = { ...allParams };
  delete cleanParams._since;
  delete cleanParams._until;

  try {
    const result = await createLeadList({
      name: listName,
      description: tpl.description,
      preset_key: tpl.preset_key,
      params: cleanParams,
      tier_filter: tpl.tier_filter,
      since,
      until,
      created_by_email: userEmail,
    });

    await supabase
      .from("lead_list_templates")
      .update({ last_run_at: new Date().toISOString(), last_list_id: result.id })
      .eq("id", id);

    return NextResponse.json({ data: result });
  } catch (e) {
    if (e instanceof CreateListError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
