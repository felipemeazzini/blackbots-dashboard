export interface CampaignStripeData {
  utmCampaign: string;
  sales: number;
  revenue: number;
}

export interface StripeMetrics {
  totalSales: number;
  totalRevenue: number;
  byCampaignName: CampaignStripeData[];
}
