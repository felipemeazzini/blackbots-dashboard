import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYNC_COOLDOWN = 5 * 60 * 1000; // 5 min

async function stripeGet(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}`);
  return res.json();
}

// Fetch subscription metadata (utm_campaign) — cache in a Map per request
const subCache = new Map<string, string>();
async function getSubUtmCampaign(subId: string): Promise<string> {
  if (!subId) return "Direto / Organico";
  if (subCache.has(subId)) return subCache.get(subId)!;
  try {
    const sub = await stripeGet(`subscriptions/${subId}`);
    const utm = sub.metadata?.utm_campaign || "Direto / Organico";
    subCache.set(subId, utm);
    return utm;
  } catch {
    return "Direto / Organico";
  }
}

async function syncNewInvoices() {
  // Get last sync timestamp
  const { data: syncStatus } = await supabase
    .from("stripe_sync_status")
    .select("last_invoice_ts, updated_at")
    .eq("id", "latest")
    .single();

  const lastTs = syncStatus?.last_invoice_ts || 0;
  const lastUpdate = syncStatus?.updated_at ? new Date(syncStatus.updated_at).getTime() : 0;

  // Skip if synced recently
  if (Date.now() - lastUpdate < SYNC_COOLDOWN && lastTs > 0) {
    return;
  }

  // Fetch new paid invoices from Stripe
  let cursor: string | undefined;
  let maxTs = lastTs;
  let totalNew = 0;

  for (let page = 0; page < 5; page++) { // Max 5 pages per sync (500 invoices)
    const params: Record<string, string> = {
      limit: "100",
      status: "paid",
    };
    if (lastTs > 0) params["created[gt]"] = String(lastTs);
    if (cursor) params.starting_after = cursor;

    const result = await stripeGet("invoices", params);
    if (!result.data || result.data.length === 0) break;

    // Process and insert
    const rows = [];
    for (const inv of result.data) {
      const subId = inv.subscription || "";
      const utm = await getSubUtmCampaign(subId);

      rows.push({
        id: inv.id,
        subscription_id: subId,
        customer_id: inv.customer || "",
        amount_paid: inv.amount_paid || 0,
        currency: inv.currency || "brl",
        paid_at: new Date(inv.created * 1000).toISOString(),
        utm_campaign: utm,
      });

      if (inv.created > maxTs) maxTs = inv.created;
    }

    if (rows.length > 0) {
      await supabase.from("stripe_invoices_cache").upsert(rows, { onConflict: "id" });
      totalNew += rows.length;
    }

    if (!result.has_more) break;
    cursor = result.data[result.data.length - 1].id;
  }

  // Update sync status
  if (maxTs > lastTs || totalNew > 0) {
    await supabase.from("stripe_sync_status").upsert({
      id: "latest",
      last_invoice_ts: maxTs,
      updated_at: new Date().toISOString(),
    });
  } else {
    // Just update timestamp to reset cooldown
    await supabase.from("stripe_sync_status").update({
      updated_at: new Date().toISOString(),
    }).eq("id", "latest");
  }
}

async function aggregateFromCache() {
  const { data: invoices } = await supabase
    .from("stripe_invoices_cache")
    .select("subscription_id, customer_id, amount_paid, utm_campaign, paid_at")
    .order("paid_at", { ascending: true });

  if (!invoices || invoices.length === 0) return null;

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86400 * 1000;

  // Group by subscription
  const bySub = new Map<string, { totalPaid: number; utm: string; firstPaid: number; lastPaid: number; invoiceCount: number }>();
  for (const inv of invoices) {
    const subId = inv.subscription_id || "unknown";
    const existing = bySub.get(subId) || {
      totalPaid: 0,
      utm: inv.utm_campaign || "Direto / Organico",
      firstPaid: new Date(inv.paid_at).getTime(),
      lastPaid: new Date(inv.paid_at).getTime(),
      invoiceCount: 0,
    };
    existing.totalPaid += inv.amount_paid / 100; // centavos -> reais
    const paidTs = new Date(inv.paid_at).getTime();
    if (paidTs < existing.firstPaid) existing.firstPaid = paidTs;
    if (paidTs > existing.lastPaid) existing.lastPaid = paidTs;
    existing.invoiceCount++;
    bySub.set(subId, existing);
  }

  // Aggregate by campaign
  const byCampaign = new Map<string, Array<{ ltv: number; lifetimeDays: number; invoices: number; isActive: boolean }>>();
  let totalSubs = 0;
  let totalActive = 0;
  let recentCancels = 0;

  for (const [, sub] of bySub) {
    totalSubs++;
    const lifetimeDays = (sub.lastPaid - sub.firstPaid) / 86400000 + 30; // +30 for current month
    // Consider active if last payment was within 45 days
    const isActive = (now - sub.lastPaid) < 45 * 86400 * 1000;
    if (isActive) totalActive++;
    if (!isActive && sub.lastPaid > thirtyDaysAgo) recentCancels++;

    const arr = byCampaign.get(sub.utm) || [];
    arr.push({ ltv: sub.totalPaid, lifetimeDays, invoices: sub.invoiceCount, isActive });
    byCampaign.set(sub.utm, arr);
  }

  const totalCanceled = totalSubs - totalActive;
  const monthlyChurnRate = totalActive > 0 ? (recentCancels / (totalActive + recentCancels)) * 100 : 0;

  const allLtvs = Array.from(bySub.values());
  const avgLtv = allLtvs.length > 0 ? allLtvs.reduce((s, d) => s + d.totalPaid, 0) / allLtvs.length : 0;
  const avgLifetimeDays = allLtvs.length > 0 ? allLtvs.reduce((s, d) => s + ((d.lastPaid - d.firstPaid) / 86400000 + 30), 0) / allLtvs.length : 0;
  const avgMonthlyPrice = allLtvs.length > 0 ? allLtvs.reduce((s, d) => s + d.totalPaid / Math.max(d.invoiceCount, 1), 0) / allLtvs.length : 0;

  const overview = {
    totalSubscribers: totalSubs,
    activeSubscribers: totalActive,
    canceledSubscribers: totalCanceled,
    monthlyChurnRate,
    avgLtv,
    avgLifetimeMonths: avgLifetimeDays / 30,
    avgMonthlyPrice,
  };

  const campaignData = Array.from(byCampaign.entries()).map(([utmCampaign, subs]) => {
    const tc = subs.length;
    const ac = subs.filter((s) => s.isActive).length;
    const cc = tc - ac;
    const campAvgLtv = subs.reduce((s, d) => s + d.ltv, 0) / tc;
    const campTotalLtv = subs.reduce((s, d) => s + d.ltv, 0);
    const campAvgLifetimeDays = subs.reduce((s, d) => s + d.lifetimeDays, 0) / tc;
    const campAvgPrice = subs.reduce((s, d) => s + d.ltv / Math.max(d.invoices, 1), 0) / tc;

    return {
      utmCampaign,
      totalCustomers: tc,
      activeCustomers: ac,
      canceledCustomers: cc,
      churnRate: tc > 0 ? (cc / tc) * 100 : 0,
      avgLifetimeDays: campAvgLifetimeDays,
      avgLifetimeMonths: campAvgLifetimeDays / 30,
      avgLtv: campAvgLtv,
      totalLtv: campTotalLtv,
      avgMonthlyPrice: campAvgPrice,
    };
  }).sort((a, b) => b.totalLtv - a.totalLtv);

  return { overview, byCampaign: campaignData };
}

export async function GET() {
  try {
    // Sync new invoices from Stripe (incremental)
    await syncNewInvoices();

    // Read from cache and aggregate
    const data = await aggregateFromCache();
    if (!data) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data, done: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
