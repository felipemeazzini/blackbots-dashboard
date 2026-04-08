import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = ["felipe@blackbots.com.br", "felipe.meazzini@gmail.com"];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Verify admin by checking the auth token from the Authorization header
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("x-user-email");
  return !!authHeader && ADMIN_EMAILS.includes(authHeader);
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;

    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      confirmed_at: u.email_confirmed_at,
    }));

    return NextResponse.json({ data: users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://blackbots-dashboard.vercel.app/auth/callback",
    });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("id");

  if (!userId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const supabase = getAdminClient();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
