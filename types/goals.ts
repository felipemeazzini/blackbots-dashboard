import { MetricKey } from "./metrics";

export interface Goal {
  id: string;
  account_id: string;
  campaign_id: string | null;
  metric_key: MetricKey;
  target_value: number;
  comparison: "lte" | "gte";
  created_at: string;
  updated_at: string;
}

export interface GoalFormData {
  metric_key: MetricKey;
  target_value: number;
  comparison: "lte" | "gte";
  campaign_id?: string;
}
