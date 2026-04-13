import Stripe from "stripe";
import { StripeMetrics } from "@/types/stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function getStripeSubscriptions(
  since: string,
  until: string
): Promise<StripeMetrics> {
  const sinceTs = Math.floor(new Date(since).getTime() / 1000);
  const untilTs = Math.floor(new Date(until + "T23:59:59").getTime() / 1000);

  // Paginate through all subscriptions in date range
  const allSubs: Stripe.Subscription[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.SubscriptionListParams = {
      created: { gte: sinceTs, lte: untilTs },
      limit: 100,
      status: "all",
      expand: ["data.items.data.price"],
    };
    if (startingAfter) params.starting_after = startingAfter;

    const batch = await stripe.subscriptions.list(params);
    allSubs.push(...batch.data);
    hasMore = batch.has_more;
    if (batch.data.length > 0) {
      startingAfter = batch.data[batch.data.length - 1].id;
    }
  }

  // Group by utm_campaign
  const byCampaign = new Map<string, { sales: number; revenue: number }>();
  let totalSales = 0;
  let totalRevenue = 0;

  for (const sub of allSubs) {
    const utmCampaign = sub.metadata?.utm_campaign || "Direto / Organico";
    const amount = sub.items.data[0]?.price?.unit_amount || 0;
    const revenue = amount / 100; // centavos -> reais

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
