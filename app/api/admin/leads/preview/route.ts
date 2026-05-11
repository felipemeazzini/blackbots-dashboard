import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getPreset } from "@/lib/leads-source/presets";
import { runPresetQuery } from "@/lib/leads-source/queries";
import { enrichLeads } from "@/lib/leads-source/scoring";
import { normalizeEmail, normalizePhoneBR } from "@/lib/leads-source/normalize";
import { ALL_TIERS, Tier } from "@/lib/leads-source/types";

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { preset_key, params, tier_filter, since, until } = body as {
    preset_key?: string;
    params?: Record<string, unknown>;
    tier_filter?: Tier[];
    since?: string | null;
    until?: string | null;
  };

  if (!preset_key || !getPreset(preset_key)) {
    return NextResponse.json({ error: "preset_key invalido" }, { status: 400 });
  }

  const tiers: Tier[] = Array.isArray(tier_filter) && tier_filter.length > 0
    ? tier_filter.filter((t): t is Tier => ALL_TIERS.includes(t))
    : ALL_TIERS;
  const tierSet = new Set(tiers);

  try {
    const raw = await runPresetQuery(preset_key, params || {});

    // Normaliza primeiro pra descartar quem nao tem email nem phone
    const normalized = raw
      .map((r) => ({
        ...r,
        email: normalizeEmail(r.email),
        phone: normalizePhoneBR(r.phone),
        name: r.name?.trim() || null,
      }))
      .filter((r) => r.email || r.phone);

    let enriched = await enrichLeads(normalized);

    if (since || until) {
      const sinceTs = since ? new Date(since).getTime() : -Infinity;
      const untilTs = until ? new Date(until + "T23:59:59").getTime() : Infinity;
      enriched = enriched.filter((l) => {
        if (!l.signup_at) return false;
        const ts = new Date(l.signup_at).getTime();
        return ts >= sinceTs && ts <= untilTs;
      });
    }

    const filtered = enriched.filter((l) => tierSet.has(l.tier));

    let withEmail = 0;
    let withPhone = 0;
    let vip = 0, engaged = 0, casual = 0, cold = 0;
    for (const l of filtered) {
      if (l.email) withEmail++;
      if (l.phone) withPhone++;
      if (l.tier === "vip") vip++;
      else if (l.tier === "engaged") engaged++;
      else if (l.tier === "casual") casual++;
      else cold++;
    }

    const sample = [...filtered]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((l) => ({
        name: l.name,
        email: l.email,
        phone: l.phone,
        tier: l.tier,
        months_active: l.months_active,
        score: l.score,
        signup_at: l.signup_at,
      }));

    return NextResponse.json({
      data: {
        total: filtered.length,
        total_with_email: withEmail,
        total_with_phone: withPhone,
        total_vip: vip,
        total_engaged: engaged,
        total_casual: casual,
        total_cold: cold,
        sample,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
