import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYNC_COOLDOWN = 5 * 60 * 1000;

async function stripeGet(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}`);
  return res.json();
}

// Build subscription -> utm_campaign map (batch, much faster)
async function buildSubUtmMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let cursor: string | undefined;
  for (let p = 0; p < 50; p++) {
    const params: Record<string, string> = { limit: "100", status: "all" };
    if (cursor) params.starting_after = cursor;
    const result = await stripeGet("subscriptions", params);
    for (const sub of result.data || []) {
      map.set(sub.id, sub.metadata?.utm_campaign || "Direto / Organico");
    }
    if (!result.has_more) break;
    cursor = result.data[result.data.length - 1]?.id;
  }
  return map;
}

async function syncInvoices(isFirstSync: boolean) {
  const { data: syncStatus } = await supabase
    .from("stripe_sync_status")
    .select("last_invoice_ts, updated_at")
    .eq("id", "latest")
    .single();

  const lastTs = syncStatus?.last_invoice_ts || 0;
  const lastUpdate = syncStatus?.updated_at ? new Date(syncStatus.updated_at).getTime() : 0;

  if (Date.now() - lastUpdate < SYNC_COOLDOWN && lastTs > 0) return;

  // Build utm map from subscriptions (one pass)
  const utmMap = await buildSubUtmMap();

  let cursor: string | undefined;
  let maxTs = lastTs;
  let totalNew = 0;
  const maxPages = isFirstSync ? 50 : 5;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = { limit: "100", status: "paid" };
    if (lastTs > 0) params["created[gt]"] = String(lastTs);
    if (cursor) params.starting_after = cursor;

    const result = await stripeGet("invoices", params);
    if (!result.data || result.data.length === 0) break;

    const rows = result.data.map((inv: Record<string, unknown>) => {
      const subId = (inv.subscription as string) || "";
      return {
        id: inv.id as string,
        subscription_id: subId,
        customer_id: (inv.customer as string) || "",
        amount_paid: (inv.amount_paid as number) || 0,
        currency: (inv.currency as string) || "brl",
        paid_at: new Date((inv.created as number) * 1000).toISOString(),
        utm_campaign: utmMap.get(subId) || "Direto / Organico",
      };
    });

    if (rows.length > 0) {
      await supabase.from("stripe_invoices_cache").upsert(rows, { onConflict: "id" });
      totalNew += rows.length;
    }

    const maxInvTs = Math.max(...result.data.map((i: Record<string, unknown>) => i.created as number));
    if (maxInvTs > maxTs) maxTs = maxInvTs;

    if (!result.has_more) break;
    cursor = result.data[result.data.length - 1].id;
  }

  await supabase.from("stripe_sync_status").upsert({
    id: "latest",
    last_invoice_ts: maxTs > lastTs ? maxTs : lastTs,
    updated_at: new Date().toISOString(),
  });
}

async function aggregateFromCache() {
  const { data: invoices } = await supabase
    .from("stripe_invoices_cache")
    .select("subscription_id, customer_id, amount_paid, utm_campaign, paid_at");

  if (!invoices || invoices.length === 0) return null;

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86400 * 1000;

  const bySub = new Map<string, { totalPaid: number; utm: string; firstPaid: number; lastPaid: number; invoiceCount: number }>();
  for (const inv of invoices) {
    const subId = inv.subscription_id || "unknown";
    const paidTs = new Date(inv.paid_at).getTime();
    const existing = bySub.get(subId) || {
      totalPaid: 0, utm: inv.utm_campaign || "Direto / Organico",
      firstPaid: paidTs, lastPaid: paidTs, invoiceCount: 0,
    };
    existing.totalPaid += inv.amount_paid / 100;
    if (paidTs < existing.firstPaid) existing.firstPaid = paidTs;
    if (paidTs > existing.lastPaid) existing.lastPaid = paidTs;
    existing.invoiceCount++;
    bySub.set(subId, existing);
  }

  const byCampaign = new Map<string, Array<{ ltv: number; lifetimeDays: number; invoices: number; isActive: boolean }>>();
  let totalActive = 0;
  let recentCancels = 0;

  for (const [, sub] of bySub) {
    const lifetimeDays = (sub.lastPaid - sub.firstPaid) / 86400000 + 30;
    const isActive = (now - sub.lastPaid) < 45 * 86400 * 1000;
    if (isActive) totalActive++;
    if (!isActive && sub.lastPaid > thirtyDaysAgo) recentCancels++;

    const arr = byCampaign.get(sub.utm) || [];
    arr.push({ ltv: sub.totalPaid, lifetimeDays, invoices: sub.invoiceCount, isActive, firstPaid: sub.firstPaid });
    byCampaign.set(sub.utm, arr);
  }

  const totalSubs = bySub.size;
  const totalCanceled = totalSubs - totalActive;
  const monthlyChurnRate = totalActive > 0 ? (recentCancels / (totalActive + recentCancels)) * 100 : 0;
  const allSubs = Array.from(bySub.values());
  const avgLtv = allSubs.length > 0 ? allSubs.reduce((s, d) => s + d.totalPaid, 0) / allSubs.length : 0;
  const avgLifetimeDays = allSubs.length > 0 ? allSubs.reduce((s, d) => s + ((d.lastPaid - d.firstPaid) / 86400000 + 30), 0) / allSubs.length : 0;
  const avgMonthlyPrice = allSubs.length > 0 ? allSubs.reduce((s, d) => s + d.totalPaid / Math.max(d.invoiceCount, 1), 0) / allSubs.length : 0;

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
    return {
      utmCampaign,
      totalCustomers: tc,
      activeCustomers: ac,
      canceledCustomers: cc,
      churnRate: tc > 0 ? (cc / tc) * 100 : 0,
      avgLifetimeDays: subs.reduce((s, d) => s + d.lifetimeDays, 0) / tc,
      avgLifetimeMonths: subs.reduce((s, d) => s + d.lifetimeDays, 0) / tc / 30,
      avgLtv: subs.reduce((s, d) => s + d.ltv, 0) / tc,
      totalLtv: subs.reduce((s, d) => s + d.ltv, 0),
      avgMonthlyPrice: subs.reduce((s, d) => s + d.ltv / Math.max(d.invoices, 1), 0) / tc,
      customerAcquisitionDates: subs.map((s) => s.firstPaid),
    };
  }).sort((a, b) => b.totalLtv - a.totalLtv);

  return { overview, byCampaign: campaignData };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const forceSync = searchParams.get("force") === "1";

  try {
    // Check if first sync
    const { data: syncStatus } = await supabase
      .from("stripe_sync_status")
      .select("last_invoice_ts")
      .eq("id", "latest")
      .single();

    const isFirstSync = !syncStatus?.last_invoice_ts || syncStatus.last_invoice_ts === 0;

    // If first sync, return partial message and do sync in background
    if (isFirstSync || forceSync) {
      // Do sync (may take a while on first run)
      await syncInvoices(isFirstSync);
    } else {
      // Incremental sync (fast)
      await syncInvoices(false);
    }

    const data = await aggregateFromCache();
    return NextResponse.json({ data, done: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
