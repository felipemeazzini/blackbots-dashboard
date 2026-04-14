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

// Retention / LTV types
export interface RetentionCampaignData {
  utmCampaign: string;
  totalCustomers: number;
  activeCustomers: number;
  canceledCustomers: number;
  churnRate: number;
  avgLifetimeDays: number;
  avgLifetimeMonths: number;
  avgLtv: number;
  totalLtv: number;
  avgMonthlyPrice: number;
  customerAcquisitionDates?: number[];
}

export interface RetentionOverview {
  totalSubscribers: number;
  activeSubscribers: number;
  canceledSubscribers: number;
  monthlyChurnRate: number;
  avgLtv: number;
  avgLifetimeMonths: number;
  avgMonthlyPrice: number;
}

export interface RetentionMetrics {
  overview: RetentionOverview;
  byCampaign: RetentionCampaignData[];
}
