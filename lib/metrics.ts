import { FacebookRawInsight } from "@/types/facebook";
import { ProcessedMetrics, MetricKey } from "@/types/metrics";

// Facebook reports the same purchase under multiple action_types
// (purchase, offsite_conversion.fb_pixel_purchase, omni_purchase, etc.)
// Use only ONE to avoid double/triple counting.
// Priority: purchase > omni_purchase > offsite_conversion.fb_pixel_purchase
const PURCHASE_TYPES_PRIORITY = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
];

const LEAD_TYPES = [
  "offsite_conversion.fb_pixel_lead",
  "lead",
];

function extractFirstMatchingAction(
  actions: { action_type: string; value: string }[] | undefined,
  typesPriority: string[]
): number {
  if (!actions) return 0;
  for (const type of typesPriority) {
    const action = actions.find((a) => a.action_type === type);
    if (action) return Number(action.value);
  }
  return 0;
}

function extractActionValue(
  actions: { action_type: string; value: string }[] | undefined,
  types: string[]
): number {
  if (!actions) return 0;
  return actions
    .filter((a) => types.includes(a.action_type))
    .reduce((sum, a) => sum + Number(a.value), 0);
}

export function processInsight(raw: FacebookRawInsight): ProcessedMetrics {
  const spend = Number(raw.spend) || 0;
  const impressions = Number(raw.impressions) || 0;
  const clicks = Number(raw.clicks) || 0;
  const reach = Number(raw.reach) || 0;
  const ctr = Number(raw.ctr) || 0;
  const cpc = Number(raw.cpc) || 0;
  const cpm = Number(raw.cpm) || 0;
  const frequency = Number(raw.frequency) || 0;
  const uniqueClicks = Number(raw.unique_clicks) || 0;

  // Use first matching type to avoid double counting
  const purchases = extractFirstMatchingAction(raw.actions, PURCHASE_TYPES_PRIORITY);
  const purchaseValue = extractFirstMatchingAction(raw.action_values, PURCHASE_TYPES_PRIORITY);
  const leads = extractFirstMatchingAction(raw.actions, LEAD_TYPES);
  const conversions = purchases + leads;

  const costPerSale = purchases > 0 ? spend / purchases : 0;
  const cac = costPerSale;
  const roas = spend > 0 ? purchaseValue / spend : 0;

  return {
    spend,
    impressions,
    clicks,
    reach,
    ctr,
    cpc,
    cpm,
    frequency,
    uniqueClicks,
    conversions,
    purchases,
    costPerSale,
    cac,
    roas,
    purchaseValue,
    dateStart: raw.date_start,
    dateStop: raw.date_stop,
  };
}

export function aggregateMetrics(metrics: ProcessedMetrics[]): ProcessedMetrics {
  if (metrics.length === 0) return emptyMetrics();

  const totals = metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      reach: acc.reach + m.reach,
      uniqueClicks: acc.uniqueClicks + m.uniqueClicks,
      conversions: acc.conversions + m.conversions,
      purchases: acc.purchases + m.purchases,
      purchaseValue: acc.purchaseValue + m.purchaseValue,
    }),
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      reach: 0,
      uniqueClicks: 0,
      conversions: 0,
      purchases: 0,
      purchaseValue: 0,
    }
  );

  return {
    ...totals,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0,
    costPerSale: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
    cac: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
    roas: totals.spend > 0 ? totals.purchaseValue / totals.spend : 0,
  };
}

export function emptyMetrics(): ProcessedMetrics {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    frequency: 0,
    uniqueClicks: 0,
    conversions: 0,
    purchases: 0,
    costPerSale: 0,
    cac: 0,
    roas: 0,
    purchaseValue: 0,
  };
}

export function formatMetric(
  value: number,
  format: "currency" | "number" | "percent" | "decimal"
): string {
  switch (format) {
    case "currency":
      return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
      });
    case "number":
      return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    case "percent":
      return `${value.toFixed(2)}%`;
    case "decimal":
      return value.toFixed(2);
  }
}

export function getMetricValue(
  metrics: ProcessedMetrics,
  key: MetricKey
): number {
  return metrics[key];
}
