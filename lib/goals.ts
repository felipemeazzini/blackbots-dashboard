import { CampaignGoal, GoalStatus } from "@/types/goals";

export function getGoalStatus(
  costPerSale: number,
  goal: CampaignGoal,
  purchases: number
): GoalStatus {
  if (!goal.cost_per_purchase_goal) return null;
  if (purchases === 0) return "insufficient";

  const target = goal.cost_per_purchase_goal;
  const warningLimit = target * (1 + goal.warning_threshold_pct);

  if (costPerSale <= target) return "green";
  if (costPerSale <= warningLimit) return "yellow";
  return "red";
}

export const ROW_COLORS: Record<string, { bg: string; text: string }> = {
  green: { bg: "rgba(34, 197, 94, 0.08)", text: "#22c55e" },
  yellow: { bg: "rgba(234, 179, 8, 0.08)", text: "#eab308" },
  red: { bg: "rgba(239, 68, 68, 0.08)", text: "#ef4444" },
};
