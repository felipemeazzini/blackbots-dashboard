"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Target, Globe, Trophy, ArrowLeftRight } from "lucide-react";

const NAV_ITEMS = [
  { href: "/geral", label: "Visao Geral", icon: Globe },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/comparativo", label: "Comparativo", icon: ArrowLeftRight },
  { href: "/metas", label: "Metas", icon: Target },
];

export default function Sidebar() {
  const pathname = usePathname();

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
      </nav>
    </aside>
  );
}
