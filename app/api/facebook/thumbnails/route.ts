import { NextRequest, NextResponse } from "next/server";
import { getAdThumbnails } from "@/lib/facebook";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ids = searchParams.get("ids");

  if (!ids) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }

  try {
    const adIds = ids.split(",").filter(Boolean);
    const thumbnails = await getAdThumbnails(adIds);
    return NextResponse.json({ data: thumbnails });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
