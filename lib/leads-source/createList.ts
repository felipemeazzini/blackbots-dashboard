import { createClient } from "@supabase/supabase-js";
import { getPreset } from "./presets";
import { runPresetQuery } from "./queries";
import { enrichLeads } from "./scoring";
import { normalizeEmail, normalizePhoneBR } from "./normalize";
import { ALL_TIERS, Tier } from "./types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_LEADS_PER_LIST = 50000;

export interface CreateListArgs {
  name: string;
  description?: string | null;
  preset_key: string;
  params: Record<string, unknown>;
  tier_filter?: Tier[];
  since?: string | null;
  until?: string | null;
  created_by_email: string;
}

export interface CreateListResult {
  id: string;
  name: string;
  total_leads: number;
  total_with_email: number;
  total_with_phone: number;
  total_vip: number;
  total_engaged: number;
  total_casual: number;
  total_cold: number;
}

export class CreateListError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function createLeadList(args: CreateListArgs): Promise<CreateListResult> {
  const { name, description, preset_key, params, since, until, created_by_email } = args;

  if (!name || name.trim().length === 0) throw new CreateListError("name obrigatorio");
  if (!preset_key || !getPreset(preset_key)) throw new CreateListError("preset_key invalido");

  const tiers: Tier[] = Array.isArray(args.tier_filter) && args.tier_filter.length > 0
    ? args.tier_filter.filter((t): t is Tier => ALL_TIERS.includes(t))
    : ALL_TIERS;
  const tierSet = new Set(tiers);

  const raw = await runPresetQuery(preset_key, params || {});

  const seen = new Set<string>();
  const normalized: { name: string | null; email: string | null; phone: string | null; source_id: string; user_id?: string | null; signup_at?: string | null }[] = [];
  for (const r of raw) {
    const email = normalizeEmail(r.email);
    const phone = normalizePhoneBR(r.phone);
    if (!email && !phone) continue;
    const dedupKey = `${email || ""}|${phone || ""}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    normalized.push({
      name: r.name?.trim() || null,
      email,
      phone,
      source_id: r.source_id,
      user_id: r.user_id ?? null,
      signup_at: r.signup_at ?? null,
    });
  }

  if (normalized.length > MAX_LEADS_PER_LIST) {
    throw new CreateListError(`Resultado excede ${MAX_LEADS_PER_LIST} leads (${normalized.length}). Refine o preset.`);
  }

  let enriched = await enrichLeads(normalized);

  // Filtro de periodo (signup_at)
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

  if (filtered.length === 0) {
    throw new CreateListError("Nenhum lead corresponde aos tiers escolhidos");
  }

  let withEmail = 0, withPhone = 0;
  let vip = 0, engaged = 0, casual = 0, cold = 0;
  for (const l of filtered) {
    if (l.email) withEmail++;
    if (l.phone) withPhone++;
    if (l.tier === "vip") vip++;
    else if (l.tier === "engaged") engaged++;
    else if (l.tier === "casual") casual++;
    else cold++;
  }

  // Resolve nome final com sufixo numerico em caso de colisao exata
  const finalName = await resolveUniqueName(name.trim());

  const { data: list, error: listErr } = await supabase
    .from("lead_lists")
    .insert({
      name: finalName,
      description: description?.trim() || null,
      preset_key,
      preset_params: params || {},
      total_leads: filtered.length,
      total_with_email: withEmail,
      total_with_phone: withPhone,
      total_vip: vip,
      total_engaged: engaged,
      total_casual: casual,
      total_cold: cold,
      tier_filter: tiers,
      created_by_email,
    })
    .select()
    .single();

  if (listErr || !list) {
    throw new CreateListError(listErr?.message || "Falha ao criar lista", 500);
  }

  const CHUNK = 500;
  for (let i = 0; i < filtered.length; i += CHUNK) {
    const slice = filtered.slice(i, i + CHUNK).map((l) => ({
      list_id: list.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      source_id: l.source_id,
      signup_at: l.signup_at ?? null,
      score: l.score,
      tier: l.tier,
      months_active: l.months_active,
      total_paid_brl: l.total_paid_brl,
      last_paid_at: l.last_paid_at,
      currently_active: l.currently_active,
    }));
    const { error: insErr } = await supabase.from("leads").insert(slice);
    if (insErr) {
      await supabase.from("lead_lists").delete().eq("id", list.id);
      throw new CreateListError(insErr.message, 500);
    }
  }

  return {
    id: list.id,
    name: list.name,
    total_leads: filtered.length,
    total_with_email: withEmail,
    total_with_phone: withPhone,
    total_vip: vip,
    total_engaged: engaged,
    total_casual: casual,
    total_cold: cold,
  };
}

async function resolveUniqueName(base: string): Promise<string> {
  const { data: exact } = await supabase
    .from("lead_lists")
    .select("id")
    .eq("name", base)
    .maybeSingle();
  if (!exact) return base;
  // Tenta sufixos -2, -3, ... ate achar um livre
  for (let i = 2; i < 100; i++) {
    const candidate = `${base} -${i}`;
    const { data } = await supabase.from("lead_lists").select("id").eq("name", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base} -${Date.now()}`;
}

export function monthSuffix(date = new Date()): string {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[date.getMonth()]}/${date.getFullYear()}`;
}
