import { NextRequest, NextResponse } from "next/server";
import { getStripeSubscriptions } from "@/lib/stripe";
import { StripeMetrics } from "@/types/stripe";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

// In-memory cache with 5 min TTL
const cache = new Map<string, { data: StripeMetrics; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function resolvePresetToDates(preset: string): { since: string; until: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  switch (preset) {
    case "today":
      return { since: fmt(today), until: fmt(today) };
    case "yesterday":
      return { since: fmt(subDays(today, 1)), until: fmt(subDays(today, 1)) };
    case "last_7d":
      return { since: fmt(subDays(today, 7)), until: fmt(today) };
    case "last_14d":
      return { since: fmt(subDays(today, 14)), until: fmt(today) };
    case "last_30d":
      return { since: fmt(subDays(today, 30)), until: fmt(today) };
    case "this_month":
      return { since: fmt(startOfMonth(today)), until: fmt(today) };
    case "last_month": {
      const lm = subMonths(today, 1);
      return { since: fmt(startOfMonth(lm)), until: fmt(endOfMonth(lm)) };
    }
    case "last_90d":
      return { since: fmt(subDays(today, 90)), until: fmt(today) };
    default:
      return { since: fmt(subDays(today, 7)), until: fmt(today) };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const preset = searchParams.get("preset") || "last_7d";
  const customSince = searchParams.get("since");
  const customUntil = searchParams.get("until");

  let since: string;
  let until: string;

  if (preset === "custom" && customSince && customUntil) {
    since = customSince;
    until = customUntil;
  } else {
    const resolved = resolvePresetToDates(preset);
    since = resolved.since;
    until = resolved.until;
  }

  const cacheKey = `${since}_${until}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ data: cached.data });
  }

  try {
    const data = await getStripeSubscriptions(since, until);
    cache.set(cacheKey, { data, ts: Date.now() });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
