import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function isAdmin(req: NextRequest): Promise<boolean> {
  const userEmail = req.headers.get("x-user-email");
  if (!userEmail) return false;
  const { data } = await supabase
    .from("user_access")
    .select("is_admin")
    .eq("email", userEmail)
    .single();
  return data?.is_admin === true;
}

export function getUserEmail(req: NextRequest): string | null {
  return req.headers.get("x-user-email");
}
