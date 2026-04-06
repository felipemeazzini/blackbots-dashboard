"use client";

import { DATE_PRESETS } from "@/lib/date-ranges";
import { Calendar } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface DateRangePickerProps {
  selectedPreset: string;
  customSince?: string;
  customUntil?: string;
  onPresetChange: (preset: string) => void;
  onCustomChange?: (since: string, until: string) => void;
}

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function applyPreset(preset: string): { since: string; until: string } | null {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (preset) {
    case "today":
      return { since: fmt(today), until: fmt(today) };
    case "yesterday":
      return { since: fmt(subDays(today, 1)), until: fmt(subDays(today, 1)) };
    case "last_7d":
      return { since: fmt(subDays(today, 7)), until: fmt(today) };
    case "last_14d":
      return { since: fmt(subDays(today, 14)), until: fmt(today) };
    case "last_30d":
      return { since: fmt(subDays(today, 30)), until: fmt(today) };
    case "this_month":
      return { since: fmt(startOfMonth(today)), until: fmt(today) };
    case "last_month": {
      const lm = subMonths(today, 1);
      return { since: fmt(startOfMonth(lm)), until: fmt(endOfMonth(lm)) };
    }
    case "last_90d":
      return { since: fmt(subDays(today, 90)), until: fmt(today) };
    default:
      return null;
  }
}

const QUICK_PRESETS = [
  { key: "last_7d", label: "7d" },
  { key: "last_14d", label: "14d" },
  { key: "last_30d", label: "30d" },
  { key: "this_month", label: "Mes" },
  { key: "last_90d", label: "90d" },
];

export default function DateRangePicker({
  selectedPreset,
  customSince,
  customUntil,
  onPresetChange,
  onCustomChange,
}: DateRangePickerProps) {
  const handlePresetClick = (key: string) => {
    const range = applyPreset(key);
    if (range) {
      onPresetChange(key);
      onCustomChange?.(range.since, range.until);
    }
  };

  const handleDateChange = (since: string, until: string) => {
    onPresetChange("custom");
    onCustomChange?.(since, until);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Botoes rapidos */}
      <div className="flex items-center gap-1">
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => handlePresetClick(p.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedPreset === p.key
                ? "bg-accent text-white"
                : "bg-bg-surface text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Campos de data */}
      <div className="flex items-center gap-2">
        <Calendar size={14} className="text-text-muted" />
        <input
          type="date"
          value={customSince || ""}
          max={customUntil || todayStr()}
          onChange={(e) =>
            handleDateChange(e.target.value, customUntil || todayStr())
          }
          className="bg-bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent [color-scheme:dark] cursor-pointer"
        />
        <span className="text-text-muted text-xs">ate</span>
        <input
          type="date"
          value={customUntil || ""}
          min={customSince || ""}
          max={todayStr()}
          onChange={(e) =>
            handleDateChange(customSince || "", e.target.value)
          }
          className="bg-bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent [color-scheme:dark] cursor-pointer"
        />
      </div>
    </div>
  );
}
