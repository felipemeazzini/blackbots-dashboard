import { NextRequest, NextResponse } from "next/server";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") || "";

  try {
    // Use fetch directly instead of Stripe SDK (faster, no retries)
    const params = new URLSearchParams({
      limit: "100",
      status: "all",
    });
    if (cursor) params.set("starting_after", cursor);

    const res = await fetch(`https://api.stripe.com/v1/subscriptions?${params}`, {
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Stripe ${res.status}: ${err}` }, { status: 500 });
    }

    const json = await res.json();
    const now = Date.now() / 1000;
    const thirtyDaysAgo = now - 30 * 86400;

    const batchData = json.data.map((sub: Record<string, unknown>) => {
      const metadata = sub.metadata as Record<string, string> | null;
      const createdTs = typeof sub.created === "number" ? sub.created : 0;
      const canceledTs = (sub.canceled_at as number) || null;
      const status = sub.status as string;
      const isActive = status === "active" || status === "past_due" || status === "trialing";
      const lifetimeDays = canceledTs ? (canceledTs - createdTs) / 86400 : (now - createdTs) / 86400;

      const items = sub.items as { data: Array<{ plan?: { amount?: number } }> } | undefined;
      const monthlyPrice = (items?.data?.[0]?.plan?.amount || 0) / 100;
      const ltv = monthlyPrice * Math.max(lifetimeDays / 30, 1);
      const utmCampaign = metadata?.utm_campaign || "Direto / Organico";

      return {
        utmCampaign,
        isActive,
        lifetimeDays,
        monthlyPrice,
        ltv,
        canceledRecently: !!canceledTs && canceledTs >= thirtyDaysAgo,
      };
    });

    const nextCursor = json.has_more && json.data.length > 0
      ? json.data[json.data.length - 1].id
      : null;

    return NextResponse.json({
      batch: batchData,
      nextCursor,
      done: !json.has_more,
      count: json.data.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
