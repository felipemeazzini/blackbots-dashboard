import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createAuthServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/auth/set-password`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_link`);
}
