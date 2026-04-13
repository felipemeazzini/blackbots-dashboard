import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { RetentionMetrics } from "@/types/stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

// Cache final result for 30 min
let fullCache: { data: RetentionMetrics; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") || undefined;

  // If we have a cached full result, return it
  if (!cursor && fullCache && Date.now() - fullCache.ts < CACHE_TTL) {
    return NextResponse.json({ data: fullCache.data, done: true });
  }

  try {
    // Fetch one page of subscriptions
    const params: Stripe.SubscriptionListParams = {
      limit: 100,
      status: "all",
    };
    if (cursor) params.starting_after = cursor;

    const batch = await stripe.subscriptions.list(params);
    const now = Date.now() / 1000;
    const thirtyDaysAgo = now - 30 * 86400;

    // Process this batch
    const batchData = batch.data.map((sub) => {
      const createdTs = typeof sub.created === "number" ? sub.created : 0;
      const canceledTs = sub.canceled_at || null;
      const isActive = sub.status === "active" || sub.status === "past_due" || sub.status === "trialing";
      const lifetimeDays = canceledTs ? (canceledTs - createdTs) / 86400 : (now - createdTs) / 86400;
      const monthlyPrice = (sub.items.data[0]?.plan?.amount || 0) / 100;
      const ltv = monthlyPrice * Math.max(lifetimeDays / 30, 1);
      const utmCampaign = sub.metadata?.utm_campaign || "Direto / Organico";

      return {
        utmCampaign,
        isActive,
        lifetimeDays,
        monthlyPrice,
        ltv,
        canceledRecently: !!canceledTs && canceledTs >= thirtyDaysAgo,
      };
    });

    const nextCursor = batch.has_more && batch.data.length > 0
      ? batch.data[batch.data.length - 1].id
      : null;

    return NextResponse.json({
      batch: batchData,
      nextCursor,
      done: !batch.has_more,
      count: batch.data.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
