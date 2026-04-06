import { NextResponse } from "next/server";
import { getAdAccounts } from "@/lib/facebook";

export async function GET() {
  try {
    const data = await getAdAccounts();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
