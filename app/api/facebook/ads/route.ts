import { NextRequest, NextResponse } from "next/server";
import { getAds } from "@/lib/facebook";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account_id");
  const adsetId = searchParams.get("adset_id") || undefined;

  if (!accountId) {
    return NextResponse.json(
      { error: "account_id is required" },
      { status: 400 }
    );
  }

  try {
    const raw = await getAds(accountId, adsetId);
    // Extract thumbnail from creative nested object
    const data = raw.data.map((ad) => {
      const adAny = ad as unknown as Record<string, unknown>;
      const creative = adAny.creative as Record<string, string> | undefined;
      return {
        ...ad,
        thumbnail_url: creative?.thumbnail_url || creative?.image_url || null,
      };
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
