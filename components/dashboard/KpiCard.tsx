"use client";

import { formatMetric } from "@/lib/metrics";
import { MetricDefinition } from "@/types/metrics";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  definition: MetricDefinition;
  value: number;
  previousValue?: number;
}

export default function KpiCard({
  definition,
  value,
  previousValue,
}: KpiCardProps) {
  const formattedValue = formatMetric(value, definition.format);

  let changePercent: number | null = null;
  if (previousValue !== undefined && previousValue > 0) {
    changePercent = ((value - previousValue) / previousValue) * 100;
  }

  const isPositiveChange =
    definition.comparison === "gte"
      ? (changePercent ?? 0) > 0
      : (changePercent ?? 0) < 0;

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
          {definition.label}
        </span>
      </div>

      <div className="text-2xl font-bold text-text-primary mb-1">
        {formattedValue}
      </div>

      {changePercent !== null && (
        <div
          className={`flex items-center gap-1 text-xs ${
            isPositiveChange ? "text-green" : "text-red"
          }`}
        >
          {isPositiveChange ? (
            <TrendingUp size={12} />
          ) : (
            <TrendingDown size={12} />
          )}
          <span>
            {changePercent > 0 ? "+" : ""}
            {changePercent.toFixed(1)}%
          </span>
          <span className="text-text-muted ml-1">vs anterior</span>
        </div>
      )}
    </div>
  );
}
