import { NextRequest, NextResponse } from "next/server";
import { getInsights } from "@/lib/facebook";
import { processInsight } from "@/lib/metrics";
import { getTimeRangeParam } from "@/lib/date-ranges";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const objectId = searchParams.get("object_id");
  const preset = searchParams.get("preset") || "last_7d";
  const customSince = searchParams.get("since") || undefined;
  const customUntil = searchParams.get("until") || undefined;
  const level = searchParams.get("level") as
    | "ad"
    | "adset"
    | "campaign"
    | "account"
    | null;
  const timeIncrement = searchParams.get("time_increment") || undefined;

  if (!objectId) {
    return NextResponse.json(
      { error: "object_id is required" },
      { status: 400 }
    );
  }

  try {
    const timeRange = getTimeRangeParam(preset, customSince, customUntil);
    const raw = await getInsights(objectId, {
      timeRange,
      level: level || undefined,
      timeIncrement,
    });

    const processed = raw.data.map((row) => {
      const metrics = processInsight(row);
      // Preserve Facebook hierarchy IDs for matching
      const extra: Record<string, string | undefined> = {};
      const rawAny = row as unknown as Record<string, unknown>;
      if (rawAny.campaign_id) extra.campaign_id = String(rawAny.campaign_id);
      if (rawAny.adset_id) extra.adset_id = String(rawAny.adset_id);
      if (rawAny.ad_id) extra.ad_id = String(rawAny.ad_id);
      if (rawAny.account_id) extra.account_id = String(rawAny.account_id);
      if (rawAny.campaign_name) extra.campaign_name = String(rawAny.campaign_name);
      if (rawAny.adset_name) extra.adset_name = String(rawAny.adset_name);
      if (rawAny.ad_name) extra.ad_name = String(rawAny.ad_name);
      return { ...metrics, ...extra };
    });

    return NextResponse.json({ data: processed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
