"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

interface UserAccess {
  status: string;
  allowed_accounts: string[] | null;
  is_admin: boolean;
}

export function useUserAccess() {
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/user-access", {
        headers: { "x-user-id": user.id },
      });
      const json = await res.json();
      setAccess(json.data || null);
      setLoading(false);
    }
    load();
  }, []);

  return { access, loading };
}
