import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin-auth";
import { buildEmailXlsx, buildWhatsappXlsx, SavedLead } from "@/lib/leads-source/xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "lista";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  if (channel !== "whatsapp" && channel !== "email") {
    return NextResponse.json({ error: "channel deve ser 'whatsapp' ou 'email'" }, { status: 400 });
  }

  const { data: list, error: listErr } = await supabase
    .from("lead_lists")
    .select("name")
    .eq("id", id)
    .single();
  if (listErr || !list) {
    return NextResponse.json({ error: "Lista nao encontrada" }, { status: 404 });
  }

  // Busca todos os leads da lista, ordenados por score desc (paginado pra evitar limite default do Supabase)
  const PAGE = 1000;
  const all: SavedLead[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("leads")
      .select("name, email, phone, tier, score")
      .eq("list_id", id)
      .order("score", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    all.push(...(data as SavedLead[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const buf = channel === "whatsapp" ? buildWhatsappXlsx(all) : buildEmailXlsx(all);
  const filename = `${slugify(list.name)}-${channel}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buf.length),
    },
  });
}
