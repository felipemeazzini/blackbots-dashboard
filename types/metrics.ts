export interface ProcessedMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  uniqueClicks: number;
  conversions: number;
  purchases: number;
  costPerSale: number;
  cac: number;
  roas: number;
  purchaseValue: number;
  dateStart?: string;
  dateStop?: string;
}

export type MetricKey =
  | "spend"
  | "impressions"
  | "clicks"
  | "reach"
  | "ctr"
  | "cpc"
  | "cpm"
  | "frequency"
  | "uniqueClicks"
  | "conversions"
  | "purchases"
  | "costPerSale"
  | "cac"
  | "roas"
  | "purchaseValue";

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  format: "currency" | "number" | "percent" | "decimal";
  comparison: "lte" | "gte";
  suffix?: string;
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "spend", label: "Gasto", format: "currency", comparison: "lte" },
  { key: "impressions", label: "Impressoes", format: "number", comparison: "gte" },
  { key: "reach", label: "Alcance", format: "number", comparison: "gte" },
  { key: "clicks", label: "Cliques", format: "number", comparison: "gte" },
  { key: "ctr", label: "CTR", format: "percent", comparison: "gte" },
  { key: "cpc", label: "CPC", format: "currency", comparison: "lte" },
  { key: "cpm", label: "CPM", format: "currency", comparison: "lte" },
  { key: "frequency", label: "Frequencia", format: "decimal", comparison: "lte" },
  { key: "conversions", label: "Conversoes", format: "number", comparison: "gte" },
  { key: "purchases", label: "Vendas", format: "number", comparison: "gte" },
  { key: "costPerSale", label: "Custo/Venda", format: "currency", comparison: "lte" },
  { key: "cac", label: "CAC", format: "currency", comparison: "lte" },
  { key: "roas", label: "ROAS", format: "decimal", comparison: "gte" },
  { key: "purchaseValue", label: "Valor Vendas", format: "currency", comparison: "gte" },
];
