import {
  FacebookResponse,
  FacebookAdAccount,
  FacebookCampaign,
  FacebookAdSet,
  FacebookAd,
  FacebookRawInsight,
  InsightParams,
} from "@/types/facebook";

const FB_API_BASE = "https://graph.facebook.com/v21.0";

async function fbRequest<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) throw new Error("FACEBOOK_ACCESS_TOKEN not configured");

  const url = new URL(`${FB_API_BASE}${path}`);
  url.searchParams.set("access_token", token);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      `Facebook API error ${res.status}: ${JSON.stringify(error)}`
    );
  }

  return res.json();
}

export async function getAdAccounts(
  userId = "me"
): Promise<FacebookResponse<FacebookAdAccount>> {
  return fbRequest(`/${userId}/adaccounts`, {
    fields: "id,name,account_status,currency,amount_spent,balance",
    limit: "100",
  });
}

export async function getCampaigns(
  accountId: string,
  statusFilter?: string
): Promise<FacebookResponse<FacebookCampaign>> {
  const params: Record<string, string> = {
    fields:
      "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time",
    limit: "100",
  };
  if (statusFilter) {
    params.effective_status = JSON.stringify([statusFilter]);
  }
  return fbRequest(`/${accountId}/campaigns`, params);
}

export async function getAdSets(
  accountId: string,
  campaignId?: string
): Promise<FacebookResponse<FacebookAdSet>> {
  const params: Record<string, string> = {
    fields:
      "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal,bid_strategy",
    limit: "100",
  };
  if (campaignId) {
    params.filtering = JSON.stringify([
      { field: "campaign.id", operator: "EQUAL", value: campaignId },
    ]);
  }
  return fbRequest(`/${accountId}/adsets`, params);
}

export async function getAds(
  accountId: string,
  adsetId?: string
): Promise<FacebookResponse<FacebookAd>> {
  const params: Record<string, string> = {
    fields: "id,name,status,effective_status,campaign_id,adset_id,creative{thumbnail_url,image_url}",
    limit: "100",
  };
  if (adsetId) {
    params.filtering = JSON.stringify([
      { field: "adset.id", operator: "EQUAL", value: adsetId },
    ]);
  }
  return fbRequest(`/${accountId}/ads`, params);
}

export async function getInsights(
  objectId: string,
  params: InsightParams
): Promise<FacebookResponse<FacebookRawInsight>> {
  const queryParams: Record<string, string> = {
    fields:
      "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,account_id,spend,impressions,clicks,reach,ctr,cpc,cpm,frequency,unique_clicks,actions,cost_per_action_type,action_values",
    limit: String(params.limit || 500),
  };

  if (typeof params.timeRange === "string") {
    queryParams.date_preset = params.timeRange;
  } else {
    queryParams.time_range = JSON.stringify(params.timeRange);
  }

  if (params.timeIncrement) {
    queryParams.time_increment = params.timeIncrement;
  }

  if (params.level) {
    queryParams.level = params.level;
  }

  return fbRequest(`/${objectId}/insights`, queryParams);
}
