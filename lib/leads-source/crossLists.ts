import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LeadKey {
  id: string;
  email: string | null;
  phone: string | null;
}

/**
 * Pra cada lead da lista informada, retorna o array de NOMES de outras listas
 * onde o mesmo email OU telefone aparece. Match permissivo: basta um dos dois.
 *
 * Usado tanto pela UI (mostrar coluna "Em outras listas") quanto pelo export
 * (incluir coluna `outras_listas` no xlsx).
 */
export async function lookupCrossLists(listId: string, leads?: LeadKey[]): Promise<Map<string, string[]>> {
  let targetLeads: LeadKey[];

  if (leads && leads.length > 0) {
    targetLeads = leads;
  } else {
    const { data, error } = await supabase
      .from("leads")
      .select("id, email, phone")
      .eq("list_id", listId);
    if (error) throw new Error(`Falha ao buscar leads da lista: ${error.message}`);
    targetLeads = (data || []) as LeadKey[];
  }

  if (targetLeads.length === 0) return new Map();

  const emails = Array.from(new Set(targetLeads.map((l) => l.email).filter((v): v is string => !!v)));
  const phones = Array.from(new Set(targetLeads.map((l) => l.phone).filter((v): v is string => !!v)));

  // Busca leads em outras listas que casam por email ou telefone
  // Supabase JS nao tem OR cross-column trivial; vamos fazer duas queries e unir
  const matches: Array<{ list_id: string; email: string | null; phone: string | null }> = [];

  const CHUNK = 200;
  for (let i = 0; emails.length && i < emails.length; i += CHUNK) {
    const slice = emails.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("leads")
      .select("list_id, email, phone")
      .neq("list_id", listId)
      .in("email", slice);
    if (error) throw new Error(`Cross-list email lookup falhou: ${error.message}`);
    if (data) matches.push(...data);
  }
  for (let i = 0; phones.length && i < phones.length; i += CHUNK) {
    const slice = phones.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("leads")
      .select("list_id, email, phone")
      .neq("list_id", listId)
      .in("phone", slice);
    if (error) throw new Error(`Cross-list phone lookup falhou: ${error.message}`);
    if (data) matches.push(...data);
  }

  if (matches.length === 0) return new Map();

  // Resolve nomes das listas
  const otherListIds = Array.from(new Set(matches.map((m) => m.list_id)));
  const { data: listsData, error: listsErr } = await supabase
    .from("lead_lists")
    .select("id, name")
    .in("id", otherListIds);
  if (listsErr) throw new Error(`Cross-list names lookup falhou: ${listsErr.message}`);
  const nameById = new Map<string, string>();
  for (const row of listsData || []) nameById.set(row.id, row.name);

  // Agrega: pra cada lead da lista atual, quais nomes de outras listas casam
  const result = new Map<string, Set<string>>();
  for (const lead of targetLeads) {
    const names = new Set<string>();
    for (const m of matches) {
      const emailHit = lead.email && m.email && m.email === lead.email;
      const phoneHit = lead.phone && m.phone && m.phone === lead.phone;
      if (emailHit || phoneHit) {
        const name = nameById.get(m.list_id);
        if (name) names.add(name);
      }
    }
    if (names.size > 0) result.set(lead.id, names);
  }

  // Converte Set → array sorted
  const finalMap = new Map<string, string[]>();
  for (const [id, names] of result) finalMap.set(id, Array.from(names).sort());
  return finalMap;
}
