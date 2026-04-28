import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYNC_COOLDOWN = 5 * 60 * 1000;

interface SubMeta {
  utm: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
}

function nonEmpty(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : undefined;
}

async function stripeGet(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}`);
  return res.json();
}

async function buildSubMetaMap(): Promise<Map<string, SubMeta>> {
  const map = new Map<string, SubMeta>();
  let cursor: string | undefined;
  for (let p = 0; p < 50; p++) {
    const params: Record<string, string> = { limit: "100", status: "all" };
    if (cursor) params.starting_after = cursor;
    const result = await stripeGet("subscriptions", params);
    for (const sub of result.data || []) {
      const meta = sub.metadata || {};
      map.set(sub.id, {
        utm: nonEmpty(meta.utm_campaign) || "Direto / Organico",
        campaignId: nonEmpty(meta.meta_campaign_id),
        adsetId: nonEmpty(meta.meta_adset_id),
        adId: nonEmpty(meta.meta_ad_id),
      });
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

  const metaMap = await buildSubMetaMap();

  let cursor: string | undefined;
  let maxTs = lastTs;
  const maxPages = isFirstSync ? 50 : 5;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = { limit: "100", status: "paid" };
    if (lastTs > 0) params["created[gt]"] = String(lastTs);
    if (cursor) params.starting_after = cursor;

    const result = await stripeGet("invoices", params);
    if (!result.data || result.data.length === 0) break;

    const rows = result.data.map((inv: Record<string, unknown>) => {
      const subId = (inv.subscription as string) || "";
      const meta = metaMap.get(subId);
      return {
        id: inv.id as string,
        subscription_id: subId,
        customer_id: (inv.customer as string) || "",
        amount_paid: (inv.amount_paid as number) || 0,
        currency: (inv.currency as string) || "brl",
        paid_at: new Date((inv.created as number) * 1000).toISOString(),
        utm_campaign: meta?.utm || "Direto / Organico",
        meta_campaign_id: meta?.campaignId ?? null,
        meta_adset_id: meta?.adsetId ?? null,
        meta_ad_id: meta?.adId ?? null,
      };
    });

    if (rows.length > 0) {
      await supabase.from("stripe_invoices_cache").upsert(rows, { onConflict: "id" });
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

// Return raw subscription-level data for client-side aggregation
async function getSubscriptionData() {
  const { data: invoices } = await supabase
    .from("stripe_invoices_cache")
    .select("subscription_id, amount_paid, utm_campaign, meta_campaign_id, meta_adset_id, meta_ad_id, paid_at");

  if (!invoices || invoices.length === 0) return [];

  const now = Date.now();
  const bySub = new Map<string, {
    subscriptionId: string;
    utmCampaign: string;
    metaCampaignId?: string;
    metaAdsetId?: string;
    metaAdId?: string;
    totalPaid: number;
    firstPaid: number;
    lastPaid: number;
    invoiceCount: number;
  }>();

  for (const inv of invoices) {
    const subId = inv.subscription_id || "unknown";
    const paidTs = new Date(inv.paid_at).getTime();
    const existing = bySub.get(subId) || {
      subscriptionId: subId,
      utmCampaign: inv.utm_campaign || "Direto / Organico",
      metaCampaignId: nonEmpty(inv.meta_campaign_id),
      metaAdsetId: nonEmpty(inv.meta_adset_id),
      metaAdId: nonEmpty(inv.meta_ad_id),
      totalPaid: 0,
      firstPaid: paidTs,
      lastPaid: paidTs,
      invoiceCount: 0,
    };
    // Preserve first non-empty ID encountered across invoices of the same sub
    if (!existing.metaCampaignId) existing.metaCampaignId = nonEmpty(inv.meta_campaign_id);
    if (!existing.metaAdsetId) existing.metaAdsetId = nonEmpty(inv.meta_adset_id);
    if (!existing.metaAdId) existing.metaAdId = nonEmpty(inv.meta_ad_id);
    existing.totalPaid += inv.amount_paid / 100;
    if (paidTs < existing.firstPaid) existing.firstPaid = paidTs;
    if (paidTs > existing.lastPaid) existing.lastPaid = paidTs;
    existing.invoiceCount++;
    bySub.set(subId, existing);
  }

  return Array.from(bySub.values()).map((sub) => ({
    subscriptionId: sub.subscriptionId,
    utmCampaign: sub.utmCampaign,
    metaCampaignId: sub.metaCampaignId,
    metaAdsetId: sub.metaAdsetId,
    metaAdId: sub.metaAdId,
    totalPaid: sub.totalPaid,
    firstPaid: sub.firstPaid,
    lastPaid: sub.lastPaid,
    invoiceCount: sub.invoiceCount,
    isActive: (now - sub.lastPaid) < 45 * 86400 * 1000,
    lifetimeDays: (sub.lastPaid - sub.firstPaid) / 86400000 + 30,
  }));
}

export async function GET() {
  try {
    const { data: syncStatus } = await supabase
      .from("stripe_sync_status")
      .select("last_invoice_ts")
      .eq("id", "latest")
      .single();

    const isFirstSync = !syncStatus?.last_invoice_ts || syncStatus.last_invoice_ts === 0;
    await syncInvoices(isFirstSync);

    const subscriptions = await getSubscriptionData();
    return NextResponse.json({ data: subscriptions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
