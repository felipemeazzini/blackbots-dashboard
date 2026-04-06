"use client";

import { ProcessedMetrics, METRIC_DEFINITIONS } from "@/types/metrics";
import { Goal } from "@/types/goals";
import KpiCard from "./KpiCard";

interface KpiGridProps {
  metrics: ProcessedMetrics;
  previousMetrics?: ProcessedMetrics;
  goals: Goal[];
}

const DASHBOARD_METRICS = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "conversions",
  "purchases",
  "costPerSale",
  "roas",
  "purchaseValue",
] as const;

export default function KpiGrid({
  metrics,
  previousMetrics,
  goals,
}: KpiGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {DASHBOARD_METRICS.map((key) => {
        const definition = METRIC_DEFINITIONS.find((d) => d.key === key);
        if (!definition) return null;

        const value = metrics[key];
        const prevValue = previousMetrics?.[key];
        const goal = goals.find((g) => g.metric_key === key);

        return (
          <KpiCard
            key={key}
            definition={definition}
            value={value}
            previousValue={prevValue}
            goal={goal}
          />
        );
      })}
    </div>
  );
}
