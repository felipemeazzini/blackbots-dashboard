import Stripe from "stripe";
import { StripeMetrics, RetentionMetrics } from "@/types/stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function getStripeSubscriptions(
  since: string,
  until: string
): Promise<StripeMetrics> {
  const sinceTs = Math.floor(new Date(since).getTime() / 1000);
  const untilTs = Math.floor(new Date(until + "T23:59:59").getTime() / 1000);

  const allSubs: Stripe.Subscription[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.SubscriptionListParams = {
      created: { gte: sinceTs, lte: untilTs },
      limit: 100,
      status: "all",
    };
    if (startingAfter) params.starting_after = startingAfter;

    const batch = await stripe.subscriptions.list(params);
    allSubs.push(...batch.data);
    hasMore = batch.has_more;
    if (batch.data.length > 0) {
      startingAfter = batch.data[batch.data.length - 1].id;
    }
  }

  const byCampaign = new Map<string, { sales: number; revenue: number }>();
  let totalSales = 0;
  let totalRevenue = 0;

  for (const sub of allSubs) {
    const utmCampaign = sub.metadata?.utm_campaign || "Direto / Organico";
    const amount = sub.items.data[0]?.plan?.amount || sub.items.data[0]?.price?.unit_amount || 0;
    const revenue = (typeof amount === "number" ? amount : 0) / 100;

    totalSales++;
    totalRevenue += revenue;

    const existing = byCampaign.get(utmCampaign) || { sales: 0, revenue: 0 };
    existing.sales++;
    existing.revenue += revenue;
    byCampaign.set(utmCampaign, existing);
  }

  const byCampaignName = Array.from(byCampaign.entries())
    .map(([utmCampaign, data]) => ({
      utmCampaign,
      sales: data.sales,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.sales - a.sales);

  return { totalSales, totalRevenue, byCampaignName };
}

// Retention / LTV data
export async function getStripeRetentionData(): Promise<RetentionMetrics> {
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - 30 * 86400;

  // Fetch recent subscriptions (max 2 pages to stay within Vercel timeout)
  const allSubs: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;

  for (let page = 0; page < 2; page++) {
    const params: Stripe.SubscriptionListParams = {
      limit: 100,
      status: "all",
    };
    if (startingAfter) params.starting_after = startingAfter;

    const batch = await stripe.subscriptions.list(params);
    allSubs.push(...batch.data);
    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1].id;
  }

  // Process each subscription
  interface SubData {
    isActive: boolean;
    lifetimeDays: number;
    ltv: number;
    monthlyPrice: number;
    canceledRecently: boolean;
  }

  const byCampaign = new Map<string, SubData[]>();
  let totalActive = 0;
  let totalCanceled = 0;
  let recentCancels = 0;

  for (const sub of allSubs) {
    const utmCampaign = sub.metadata?.utm_campaign || "Direto / Organico";
    const createdTs = typeof sub.created === "number" ? sub.created : 0;
    const canceledTs = sub.canceled_at || null;
    const isActive = sub.status === "active" || sub.status === "past_due" || sub.status === "trialing";
    const isCanceled = sub.status === "canceled" || sub.status === "incomplete_expired";

    const lifetimeDays = canceledTs
      ? (canceledTs - createdTs) / 86400
      : (now - createdTs) / 86400;

    const priceAmount = sub.items.data[0]?.plan?.amount || sub.items.data[0]?.price?.unit_amount || 0;
    const monthlyPrice = (typeof priceAmount === "number" ? priceAmount : 0) / 100;
    const lifetimeMonths = Math.max(lifetimeDays / 30, 1);
    const ltv = monthlyPrice * lifetimeMonths;

    if (isActive) totalActive++;
    if (isCanceled) totalCanceled++;
    if (canceledTs && canceledTs >= thirtyDaysAgo) recentCancels++;

    const arr = byCampaign.get(utmCampaign) || [];
    arr.push({ isActive, lifetimeDays, ltv, monthlyPrice, canceledRecently: !!canceledTs && canceledTs >= thirtyDaysAgo });
    byCampaign.set(utmCampaign, arr);
  }

  const total = allSubs.length;
  const allLtvs = Array.from(byCampaign.values()).flat();
  const avgLtv = allLtvs.length > 0 ? allLtvs.reduce((s, d) => s + d.ltv, 0) / allLtvs.length : 0;
  const avgLifetimeDays = allLtvs.length > 0 ? allLtvs.reduce((s, d) => s + d.lifetimeDays, 0) / allLtvs.length : 0;
  const avgMonthlyPrice = allLtvs.length > 0 ? allLtvs.reduce((s, d) => s + d.monthlyPrice, 0) / allLtvs.length : 0;
  const monthlyChurnRate = totalActive > 0 ? (recentCancels / (totalActive + recentCancels)) * 100 : 0;

  const overview = {
    totalSubscribers: total,
    activeSubscribers: totalActive,
    canceledSubscribers: totalCanceled,
    monthlyChurnRate,
    avgLtv,
    avgLifetimeMonths: avgLifetimeDays / 30,
    avgMonthlyPrice,
  };

  const campaignData = Array.from(byCampaign.entries()).map(([utmCampaign, subs]) => {
    const totalCustomers = subs.length;
    const activeCustomers = subs.filter((s) => s.isActive).length;
    const canceledCustomers = subs.filter((s) => !s.isActive).length;
    const churnRate = totalCustomers > 0 ? (canceledCustomers / totalCustomers) * 100 : 0;
    const campAvgLifetimeDays = subs.reduce((s, d) => s + d.lifetimeDays, 0) / totalCustomers;
    const campAvgLtv = subs.reduce((s, d) => s + d.ltv, 0) / totalCustomers;
    const campTotalLtv = subs.reduce((s, d) => s + d.ltv, 0);
    const campAvgPrice = subs.reduce((s, d) => s + d.monthlyPrice, 0) / totalCustomers;

    return {
      utmCampaign,
      totalCustomers,
      activeCustomers,
      canceledCustomers,
      churnRate,
      avgLifetimeDays: campAvgLifetimeDays,
      avgLifetimeMonths: campAvgLifetimeDays / 30,
      avgLtv: campAvgLtv,
      totalLtv: campTotalLtv,
      avgMonthlyPrice: campAvgPrice,
    };
  }).sort((a, b) => b.totalLtv - a.totalLtv);

  return { overview, byCampaign: campaignData };
}
