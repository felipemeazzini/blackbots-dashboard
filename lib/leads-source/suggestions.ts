import { createClient } from "@supabase/supabase-js";
import { getLeadsPool } from "./client";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MIN_THRESHOLD = 20;

export type Suggestion =
  | {
      type: "template_overdue";
      template_id: string;
      template_name: string;
      preset_key: string;
      days_overdue: number;
      label: string;
    }
  | {
      type: "new_signups";
      count: number;
      since_iso: string;
      label: string;
      preset_key: "recent_signups";
      params: { days: number };
    }
  | {
      type: "recent_cancels";
      count: number;
      label: string;
      preset_key: "canceled_in_period";
      params: { days: number };
    };

export async function buildSuggestions(): Promise<Suggestion[]> {
  const out: Suggestion[] = [];

  // 1. Templates atrasados
  const { data: tpls } = await supabase
    .from("lead_list_templates")
    .select("id, name, preset_key, schedule_days, last_run_at");
  const now = Date.now();
  for (const t of tpls || []) {
    if (!t.last_run_at) {
      // Nunca rodou — sugere rodar pela primeira vez
      out.push({
        type: "template_overdue",
        template_id: t.id,
        template_name: t.name,
        preset_key: t.preset_key,
        days_overdue: 0,
        label: `Template "${t.name}" ainda nao foi gerado nenhuma vez`,
      });
      continue;
    }
    const lastTs = new Date(t.last_run_at).getTime();
    const elapsedDays = (now - lastTs) / 86400000;
    if (elapsedDays >= t.schedule_days) {
      out.push({
        type: "template_overdue",
        template_id: t.id,
        template_name: t.name,
        preset_key: t.preset_key,
        days_overdue: Math.floor(elapsedDays - t.schedule_days),
        label: `Template "${t.name}" esta ${Math.floor(elapsedDays)} dias atras (agendado a cada ${t.schedule_days})`,
      });
    }
  }

  // 2. Novos cadastros desde a ultima lista de recent_signups
  const { data: lastSignupList } = await supabase
    .from("lead_lists")
    .select("id, created_at")
    .eq("preset_key", "recent_signups")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSignupList?.created_at) {
    try {
      const pool = getLeadsPool();
      const { rows } = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM prod."User" WHERE "createdAt" > $1::timestamptz`,
        [lastSignupList.created_at]
      );
      const count = Number(rows[0]?.count || 0);
      if (count >= MIN_THRESHOLD) {
        const sinceDate = new Date(lastSignupList.created_at);
        const sinceDays = Math.max(1, Math.ceil((now - sinceDate.getTime()) / 86400000));
        out.push({
          type: "new_signups",
          count,
          since_iso: lastSignupList.created_at,
          label: `${count} novos cadastros desde sua ultima lista de signups (${sinceDays}d)`,
          preset_key: "recent_signups",
          params: { days: sinceDays },
        });
      }
    } catch {
      // sem leads DB disponivel — silencia
    }
  }

  // 3. Cancelamentos recentes (ultimos 7 dias)
  try {
    const pool = getLeadsPool();
    const { rows } = await pool.query<{ count: string }>(
      `
      SELECT COUNT(DISTINCT u.id)::text AS count
      FROM prod."User" u
      WHERE EXISTS (
        SELECT 1 FROM prod."UserPurchase" p
        WHERE p."userId" = u.id AND p."isActive" = false AND p."updatedAt" >= NOW() - INTERVAL '7 days'
      )
         OR EXISTS (
        SELECT 1 FROM prod."AutoChartsContract" a
        WHERE a."userId" = u.id AND a."isActive" = false AND a."updatedAt" >= NOW() - INTERVAL '7 days'
      )
      `
    );
    const count = Number(rows[0]?.count || 0);
    if (count >= MIN_THRESHOLD) {
      out.push({
        type: "recent_cancels",
        count,
        label: `${count} cancelamentos nos ultimos 7 dias — vale uma lista de retencao`,
        preset_key: "canceled_in_period",
        params: { days: 7 },
      });
    }
  } catch {
    // sem leads DB — silencia
  }

  return out;
}
