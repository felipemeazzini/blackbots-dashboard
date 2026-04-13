"use client";

import { ReactNode } from "react";
import { FacebookAdAccount } from "@/types/facebook";
import DateRangePicker from "./DateRangePicker";
import { Building2, RefreshCw } from "lucide-react";

const REFRESH_OPTIONS = [
  { value: 0, label: "Desligado" },
  { value: 60000, label: "1 min" },
  { value: 300000, label: "5 min" },
  { value: 900000, label: "15 min" },
];

interface HeaderProps {
  accounts: FacebookAdAccount[];
  selectedAccountId: string;
  onAccountChange: (accountId: string) => void;
  selectedPreset: string;
  customSince?: string;
  customUntil?: string;
  onPresetChange: (preset: string) => void;
  onCustomChange?: (since: string, until: string) => void;
  autoRefreshInterval?: number;
  onAutoRefreshChange?: (ms: number) => void;
  actions?: ReactNode;
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export default function Header({
  accounts,
  selectedAccountId,
  onAccountChange,
  selectedPreset,
  customSince,
  customUntil,
  onPresetChange,
  onCustomChange,
  autoRefreshInterval = 0,
  onAutoRefreshChange,
  actions,
  title,
  breadcrumbs,
}: HeaderProps) {
  const isAutoRefreshActive = autoRefreshInterval > 0;

  return (
    <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span>/</span>}
                  {crumb.href ? (
                    <a
                      href={crumb.href}
                      className="hover:text-accent transition-colors"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-text-secondary">{crumb.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
          {title && (
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-text-muted" />
            <select
              value={selectedAccountId}
              onChange={(e) => onAccountChange(e.target.value)}
              className="bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent max-w-[280px]"
            >
              <option value="all">Todas as contas</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-px h-6 bg-border" />

          <DateRangePicker
            selectedPreset={selectedPreset}
            customSince={customSince}
            customUntil={customUntil}
            onPresetChange={onPresetChange}
            onCustomChange={onCustomChange}
          />

          {onAutoRefreshChange && (
            <>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-2">
                <RefreshCw
                  size={14}
                  className={`${
                    isAutoRefreshActive
                      ? "text-green animate-spin"
                      : "text-text-muted"
                  }`}
                  style={
                    isAutoRefreshActive
                      ? { animationDuration: "3s" }
                      : undefined
                  }
                />
                <select
                  value={autoRefreshInterval}
                  onChange={(e) =>
                    onAutoRefreshChange(Number(e.target.value))
                  }
                  className="bg-bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  {REFRESH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {actions}
        </div>
      </div>
    </header>
  );
}
