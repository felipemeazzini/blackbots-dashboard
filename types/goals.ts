export interface CampaignGoal {
  id: string;
  account_id: string;
  campaign_id: string;
  level: "campaign" | "adset";
  cost_per_purchase_goal: number | null;
  min_purchases_threshold: number;
  warning_threshold_pct: number;
  critical_threshold_pct: number;
  created_at: string;
  updated_at: string;
}

export type GoalStatus = "green" | "yellow" | "red" | "insufficient" | null;
