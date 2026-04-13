"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { LayoutDashboard, Megaphone, Target, Globe, Trophy, ArrowLeftRight, HeartPulse, Users, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { href: "/geral", label: "Visao Geral", icon: Globe },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/comparativo", label: "Comparativo", icon: ArrowLeftRight },
  { href: "/retencao", label: "Retencao", icon: HeartPulse },
  { href: "/metas", label: "Metas", icon: Target },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        // Check admin status
        const res = await fetch("/api/user-access", {
          headers: { "x-user-id": user.id },
        });
        const json = await res.json();
        if (json.data?.is_admin) setIsAdmin(true);
      }
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-bg-surface border-r border-border flex flex-col z-50">
      <div className="px-6 py-5 border-b border-border">
        <h1 className="text-xl font-bold text-text-primary">
          <span className="text-accent">Black</span>Bots
        </h1>
        <p className="text-xs text-text-muted mt-0.5">Marketing Dashboard</p>
      </div>

      <nav className="flex-1 py-4 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-border" />
            <Link
              href="/admin/usuarios"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                pathname === "/admin/usuarios"
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              <Users size={18} />
              Usuarios
            </Link>
          </>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-border">
        {userEmail && (
          <p className="text-[10px] text-text-muted truncate px-3 mb-2" title={userEmail}>
            {userEmail}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted hover:bg-bg-hover hover:text-red transition-colors w-full"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
