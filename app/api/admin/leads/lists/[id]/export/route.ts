import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin-auth";
import {
  buildEmailXlsxChunks,
  buildWhatsappXlsxChunks,
  bundleXlsxToZip,
  SavedLead,
} from "@/lib/leads-source/xlsx";
import { lookupCrossLists } from "@/lib/leads-source/crossLists";

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

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
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

  // Pagina todos os leads
  const PAGE = 1000;
  const all: (SavedLead & { id: string })[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, email, phone, tier, score, signup_at")
      .eq("list_id", id)
      .order("score", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    all.push(...(data as (SavedLead & { id: string })[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Cross-list: monta appeared_in_lists por lead
  const crossMap = await lookupCrossLists(
    id,
    all.map((l) => ({ id: l.id, email: l.email, phone: l.phone }))
  );
  for (const l of all) {
    l.appeared_in_lists = crossMap.get(l.id) || [];
  }

  const chunks =
    channel === "whatsapp"
      ? buildWhatsappXlsxChunks(all)
      : buildEmailXlsxChunks(all);

  if (chunks.length === 0) {
    return NextResponse.json({ error: `Nenhum lead com ${channel === "whatsapp" ? "telefone" : "email"}` }, { status: 400 });
  }

  const slug = slugify(list.name);

  if (chunks.length === 1) {
    const buf = chunks[0];
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${slug}-${channel}.xlsx"`,
        "Content-Length": String(buf.length),
      },
    });
  }

  // ZIP com multiplos arquivos
  const filesByName: Record<string, Buffer> = {};
  chunks.forEach((buf, i) => {
    filesByName[`${slug}-${channel}-${pad2(i + 1)}.xlsx`] = buf;
  });
  const zipBuf = await bundleXlsxToZip(filesByName);

  return new NextResponse(new Uint8Array(zipBuf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-${channel}.zip"`,
      "Content-Length": String(zipBuf.length),
    },
  });
}
