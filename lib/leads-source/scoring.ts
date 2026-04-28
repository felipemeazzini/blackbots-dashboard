import { createClient } from "@supabase/supabase-js";
import { getLeadsPool } from "./client";
import { EnrichedLead, RawLead, Tier } from "./types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UserContracts {
  subscriptionIds: Set<string>;
  hasActive: boolean;
}

interface InvoiceRow {
  subscription_id: string;
  amount_paid: number;
  paid_at: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function classify(currentlyActive: boolean, monthsActive: number): Tier {
  if (currentlyActive || monthsActive >= 12) return "vip";
  if (monthsActive >= 3) return "engaged";
  if (monthsActive >= 1) return "casual";
  return "cold";
}

function computeScore(currentlyActive: boolean, monthsActive: number, totalPaidBrl: number): number {
  return (
    (currentlyActive ? 1000 : 0) +
    monthsActive * 100 +
    Math.round(totalPaidBrl / 100)
  );
}

export async function enrichLeads(leads: RawLead[]): Promise<EnrichedLead[]> {
  // 1. Coletar userIds unicos (pulando leads sem user_id)
  const userIds = Array.from(
    new Set(leads.map((l) => l.user_id).filter((v): v is string => !!v))
  );

  const userContracts = new Map<string, UserContracts>();
  const invoicesBySub = new Map<string, InvoiceRow[]>();

  if (userIds.length > 0) {
    // 2. Query banco externo: contratos (UserPurchase + AutoChartsContract) em chunks de 1000
    const pool = getLeadsPool();
    for (const ids of chunk(userIds, 1000)) {
      const { rows } = await pool.query<{ userId: string; subscriptionId: string; isActive: boolean }>(
        `
        SELECT "userId", "subscriptionId", "isActive"
          FROM prod."UserPurchase"
          WHERE "userId" = ANY($1::text[])
        UNION ALL
        SELECT "userId", "subscriptionId", "isActive"
          FROM prod."AutoChartsContract"
          WHERE "userId" = ANY($1::text[])
        `,
        [ids]
      );
      for (const r of rows) {
        if (!r.subscriptionId) continue;
        let entry = userContracts.get(r.userId);
        if (!entry) {
          entry = { subscriptionIds: new Set(), hasActive: false };
          userContracts.set(r.userId, entry);
        }
        entry.subscriptionIds.add(r.subscriptionId);
        if (r.isActive) entry.hasActive = true;
      }
    }

    // 3. Query Supabase: invoices em chunks de 500 subscription_ids
    const allSubs = new Set<string>();
    for (const c of userContracts.values()) for (const s of c.subscriptionIds) allSubs.add(s);
    const subList = Array.from(allSubs);
    for (const ids of chunk(subList, 500)) {
      const { data, error } = await supabase
        .from("stripe_invoices_cache")
        .select("subscription_id, amount_paid, paid_at")
        .in("subscription_id", ids);
      if (error) throw new Error(`Stripe cache lookup falhou: ${error.message}`);
      for (const inv of data || []) {
        const arr = invoicesBySub.get(inv.subscription_id) || [];
        arr.push(inv as InvoiceRow);
        invoicesBySub.set(inv.subscription_id, arr);
      }
    }
  }

  // 4. Computar scoring por lead
  return leads.map((lead) => {
    const userId = lead.user_id || null;
    let monthsActive = 0;
    let totalPaidBrl = 0;
    let lastPaidAt: string | null = null;
    let currentlyActive = false;

    if (userId) {
      const contracts = userContracts.get(userId);
      if (contracts) {
        currentlyActive = contracts.hasActive;
        const months = new Set<string>();
        for (const sub of contracts.subscriptionIds) {
          const invs = invoicesBySub.get(sub) || [];
          for (const inv of invs) {
            totalPaidBrl += inv.amount_paid / 100;
            const ym = inv.paid_at.slice(0, 7); // YYYY-MM
            months.add(ym);
            if (!lastPaidAt || inv.paid_at > lastPaidAt) lastPaidAt = inv.paid_at;
          }
        }
        monthsActive = months.size;
      }
    }

    const tier = classify(currentlyActive, monthsActive);
    const score = computeScore(currentlyActive, monthsActive, totalPaidBrl);

    return {
      ...lead,
      score,
      tier,
      months_active: monthsActive,
      total_paid_brl: Math.round(totalPaidBrl * 100) / 100,
      last_paid_at: lastPaidAt,
      currently_active: currentlyActive,
    };
  });
}
