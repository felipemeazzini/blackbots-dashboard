export interface CampaignGoal {
  id: string;
  account_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  level: "campaign" | "adset";
  metric: "cost_per_purchase" | "roas";
  goal_value: number;
  min_purchases_threshold: number;
  warning_threshold_pct: number;
  critical_threshold_pct: number;
  created_at: string;
  updated_at: string;
}

export type GoalStatus = "green" | "yellow" | "red" | "pause" | "insufficient";

export interface CampaignGoalForm {
  campaign_id: string;
  cost_per_purchase_goal?: number;
  roas_goal?: number;
  min_purchases_threshold?: number;
  warning_threshold_pct?: number;
  critical_threshold_pct?: number;
}
