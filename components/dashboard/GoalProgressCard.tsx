"use client";

import { formatMetric } from "@/lib/metrics";
import { MetricDefinition } from "@/types/metrics";
import { Goal } from "@/types/goals";
import { TrendingUp, TrendingDown, Target } from "lucide-react";

interface GoalProgressCardProps {
  definition: MetricDefinition;
  actual: number;
  goal: Goal;
}

function getProgress(actual: number, target: number, comparison: "lte" | "gte"): {
  percent: number;
  status: "on" | "near" | "off";
  color: string;
  bgColor: string;
} {
  if (target === 0) return { percent: 0, status: "off", color: "bg-text-muted", bgColor: "bg-text-muted/20" };

  let percent: number;
  let status: "on" | "near" | "off";

  if (comparison === "gte") {
    // Higher is better (ROAS, CTR, Vendas)
    percent = Math.min((actual / target) * 100, 150);
    if (actual >= target) status = "on";
    else if (actual >= target * 0.8) status = "near";
    else status = "off";
  } else {
    // Lower is better (CPM, CPC, CAC)
    if (actual === 0) {
      percent = 100;
      status = "on";
    } else {
      percent = Math.min((target / actual) * 100, 150);
      if (actual <= target) status = "on";
      else if (actual <= target * 1.2) status = "near";
      else status = "off";
    }
  }

  const colors = {
    on: { color: "bg-green", bgColor: "bg-green/20" },
    near: { color: "bg-yellow", bgColor: "bg-yellow/20" },
    off: { color: "bg-red", bgColor: "bg-red/20" },
  };

  return { percent: Math.max(0, Math.min(percent, 100)), status, ...colors[status] };
}

export default function GoalProgressCard({
  definition,
  actual,
  goal,
}: GoalProgressCardProps) {
  const formattedActual = formatMetric(actual, definition.format);
  const formattedTarget = formatMetric(goal.target_value, definition.format);
  const { percent, status, color, bgColor } = getProgress(
    actual,
    goal.target_value,
    goal.comparison
  );

  const statusLabels = { on: "Na meta", near: "Quase la", off: "Fora da meta" };
  const statusColors = { on: "text-green", near: "text-yellow", off: "text-red" };
  const isGood = goal.comparison === "gte" ? actual >= goal.target_value : actual <= goal.target_value;

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-5 hover:border-accent/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-text-muted" />
          <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
            {definition.label}
          </span>
        </div>
        <span className={`text-xs font-medium ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
      </div>

      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-2xl font-bold text-text-primary">{formattedActual}</span>
        <span className="text-sm text-text-muted">/ {formattedTarget}</span>
      </div>

      {/* Barra de progresso */}
      <div className={`w-full h-2 rounded-full ${bgColor} mt-3 mb-2`}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {percent.toFixed(0)}% da meta
        </span>
        <div className={`flex items-center gap-1 text-xs ${isGood ? "text-green" : "text-red"}`}>
          {isGood ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          <span>{goal.comparison === "lte" ? "Menor e melhor" : "Maior e melhor"}</span>
        </div>
      </div>
    </div>
  );
}
