import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdmin(req: NextRequest): Promise<boolean> {
  const userEmail = req.headers.get("x-user-email");
  if (!userEmail) return false;
  const { data } = await supabase
    .from("user_access")
    .select("is_admin")
    .eq("email", userEmail)
    .single();
  return data?.is_admin === true;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("user_access")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id, status, allowed_accounts, is_admin } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) updates.status = status;
  if (allowed_accounts !== undefined) updates.allowed_accounts = allowed_accounts;
  if (is_admin !== undefined) updates.is_admin = is_admin;

  const { data, error } = await supabase
    .from("user_access")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const userId = searchParams.get("user_id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Delete from user_access
  await supabase.from("user_access").delete().eq("id", id);

  // Delete from auth.users
  if (userId) {
    await supabase.auth.admin.deleteUser(userId);
  }

  return NextResponse.json({ success: true });
}
