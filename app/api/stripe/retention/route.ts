import { NextResponse } from "next/server";
import { getStripeRetentionData } from "@/lib/stripe";
import { RetentionMetrics } from "@/types/stripe";

// Cache 30 min
let cache: { data: RetentionMetrics; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ data: cache.data });
  }

  try {
    const data = await getStripeRetentionData();
    cache = { data, ts: Date.now() };
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
