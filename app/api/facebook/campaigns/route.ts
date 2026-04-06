import { NextRequest, NextResponse } from "next/server";
import { getCampaigns } from "@/lib/facebook";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account_id");
  const statusFilter = searchParams.get("status") || undefined;

  if (!accountId) {
    return NextResponse.json(
      { error: "account_id is required" },
      { status: 400 }
    );
  }

  try {
    const data = await getCampaigns(accountId, statusFilter);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
