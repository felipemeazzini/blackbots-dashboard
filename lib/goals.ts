import { CampaignGoal, GoalStatus } from "@/types/goals";

export function getGoalStatus(
  actualValue: number,
  goal: CampaignGoal,
  purchases: number
): GoalStatus {
  if (purchases < goal.min_purchases_threshold) return "insufficient";

  const { goal_value, warning_threshold_pct, critical_threshold_pct, metric } = goal;

  if (metric === "cost_per_purchase") {
    // Lower is better
    if (actualValue <= goal_value) return "green";
    if (actualValue <= goal_value * (1 + warning_threshold_pct)) return "yellow";
    if (actualValue <= goal_value * (1 + critical_threshold_pct)) return "red";
    return "pause";
  }

  // ROAS — higher is better
  if (actualValue >= goal_value) return "green";
  if (actualValue >= goal_value * (1 - warning_threshold_pct)) return "yellow";
  if (actualValue >= goal_value * (1 - critical_threshold_pct)) return "red";
  return "pause";
}

export const STATUS_CONFIG: Record<
  GoalStatus,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  green: {
    label: "Na meta",
    color: "text-green",
    bgColor: "bg-green/10",
    dotColor: "bg-green",
  },
  yellow: {
    label: "Atencao",
    color: "text-yellow",
    bgColor: "bg-yellow/10",
    dotColor: "bg-yellow",
  },
  red: {
    label: "Critico",
    color: "text-red",
    bgColor: "bg-red/10",
    dotColor: "bg-red",
  },
  pause: {
    label: "Pausar",
    color: "text-red",
    bgColor: "bg-red/20",
    dotColor: "bg-red",
  },
  insufficient: {
    label: "Dados insuficientes",
    color: "text-text-muted",
    bgColor: "bg-text-muted/10",
    dotColor: "bg-text-muted",
  },
};
