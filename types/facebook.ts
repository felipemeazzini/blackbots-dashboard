export interface FacebookAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  amount_spent: string;
  balance: string;
}

export interface FacebookCampaign {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

export interface FacebookAdSet {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  bid_strategy?: string;
}

export interface FacebookAd {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id: string;
  adset_id: string;
}

export interface FacebookAction {
  action_type: string;
  value: string;
}

export interface FacebookRawInsight {
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  ctr: string;
  cpc: string;
  cpm: string;
  frequency: string;
  unique_clicks?: string;
  actions?: FacebookAction[];
  cost_per_action_type?: FacebookAction[];
  action_values?: FacebookAction[];
  date_start?: string;
  date_stop?: string;
}

export interface FacebookPaging {
  cursors: {
    before: string;
    after: string;
  };
  next?: string;
}

export interface FacebookResponse<T> {
  data: T[];
  paging?: FacebookPaging;
}

export interface InsightParams {
  timeRange: string | { since: string; until: string };
  timeIncrement?: string;
  level?: "ad" | "adset" | "campaign" | "account";
  limit?: number;
}
