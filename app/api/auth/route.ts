// Auth is now handled by Supabase Auth client-side
// This route is kept for compatibility but does nothing
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "Use Supabase Auth client-side" });
}
