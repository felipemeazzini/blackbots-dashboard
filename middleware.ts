import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase-middleware";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const { response } = createSupabaseMiddlewareClient(request);
    return response;
  }

  // Allow static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Allow data API routes (each one enforces its own auth)
  if (pathname.startsWith("/api/facebook") || pathname.startsWith("/api/stripe") || pathname.startsWith("/api/goals") || pathname.startsWith("/api/budgets") || pathname.startsWith("/api/user-access") || pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  // Check Supabase session (com timeout pra nao estourar o edge timeout da Vercel)
  const { supabase, response } = createSupabaseMiddlewareClient(request);
  const user = await Promise.race<{ id: string } | null>([
    supabase.auth.getUser().then((r) => r.data.user),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
