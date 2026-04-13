"use client";

import { useMemo, useEffect } from "react";
import { useInsights, useCampaigns } from "@/hooks/useFacebookData";
import { useFilteredAccounts } from "@/hooks/useFilteredAccounts";
import { useThumbnails } from "@/hooks/useThumbnails";
import { useAppContext } from "@/contexts/AppContext";
import { useGoals } from "@/hooks/useGoals";
import { aggregateMetrics, emptyMetrics } from "@/lib/metrics";
import { getGoalStatus } from "@/lib/goals";
import { ProcessedMetrics } from "@/types/metrics";
import Header from "@/components/layout/Header";
import KpiGrid from "@/components/dashboard/KpiGrid";
import MetricsTable from "@/components/dashboard/MetricsTable";
import SpendAreaChart from "@/components/charts/AreaChart";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import BudgetTracker from "@/components/dashboard/BudgetTracker";
import StripeKpiCards from "@/components/dashboard/StripeKpiCards";
import ExportButton from "@/components/dashboard/ExportButton";
import { PdfExportData } from "@/lib/export-pdf";
import { useStripeData } from "@/hooks/useStripeData";

export default function DashboardPage() {
  const {
    selectedAccountId,
    setSelectedAccountId,
    dateRange,
    setPreset,
    setCustomRange,
    dateQueryString,
    autoRefreshInterval,
    setAutoRefreshInterval,
    previousDateQueryString,
  } = useAppContext();

  const { accounts, loading: accountsLoading } = useFilteredAccounts();

  // Auto-selecionar a primeira conta quando carrega
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [selectedAccountId, accounts, setSelectedAccountId]);

  const activeAccount = selectedAccountId || accounts[0]?.id || "";

  // Dados diarios - usados para KPIs (agregados) e grafico
  const { data: dailyData, loading: dailyLoading } = useInsights(
    activeAccount,
    dateQueryString,
    undefined,
    "1",
    autoRefreshInterval
  );

  // Insights por campanha (com time_increment=1 e level=campaign para garantir dados)
  const { data: campaignInsightsData } = useInsights(
    activeAccount,
    dateQueryString,
    "campaign",
    "1",
    autoRefreshInterval
  );

  // Insights por anuncio
  const { data: adInsightsData } = useInsights(
    activeAccount,
    dateQueryString,
    "ad",
    "1",
    autoRefreshInterval
  );

  const { data: campaignsData } = useCampaigns(activeAccount, undefined, autoRefreshInterval);
  const campaigns = campaignsData?.data || [];

  const { goals } = useGoals(activeAccount);

  // Dados do periodo anterior (para comparacao)
  const { data: prevDailyData } = useInsights(
    previousDateQueryString ? activeAccount : null,
    previousDateQueryString || "",
    undefined,
    "1"
  );

  // KPIs: agregar dados diarios
  const metrics: ProcessedMetrics = useMemo(() => {
    if (!dailyData?.data?.length) return emptyMetrics();
    return aggregateMetrics(dailyData.data as ProcessedMetrics[]);
  }, [dailyData]);

  // KPIs do periodo anterior (para comparacao)
  const previousMetrics: ProcessedMetrics | undefined = useMemo(() => {
    if (!prevDailyData?.data?.length) return undefined;
    return aggregateMetrics(prevDailyData.data as ProcessedMetrics[]);
  }, [prevDailyData]);

  // Dados do grafico diario
  const chartData = useMemo(() => {
    if (!dailyData?.data) return [];
    return (dailyData.data as ProcessedMetrics[]).map((d) => ({
      date: d.dateStart
        ? new Date(d.dateStart).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })
        : "",
      value: d.spend,
      value2: d.purchases,
    }));
  }, [dailyData]);

  // Tabela de campanhas: agregar dados diarios por campanha
  const campaignRows = useMemo(() => {
    if (!campaignInsightsData?.data) return [];
    const insightsList = campaignInsightsData.data as (ProcessedMetrics & {
      campaign_id?: string;
    })[];

    // Agrupar por campaign_id e agregar
    const byCampaign = new Map<string, ProcessedMetrics[]>();
    for (const row of insightsList) {
      const cid = (row as unknown as Record<string, unknown>).campaign_id as string;
      if (!cid) continue;
      if (!byCampaign.has(cid)) byCampaign.set(cid, []);
      byCampaign.get(cid)!.push(row);
    }

    return campaigns
      .map((c) => {
        const rows = byCampaign.get(c.id);
        const m = rows ? aggregateMetrics(rows) : emptyMetrics();
        const goal = goals.find((g) => g.campaign_id === c.id);
        const goalStatus = goal
          ? getGoalStatus(m.costPerSale, goal, m.purchases)
          : undefined;
        return {
          id: c.id,
          name: c.name,
          status: c.effective_status,
          metrics: m,
          goalStatus,
        };
      })
      .sort((a, b) => b.metrics.spend - a.metrics.spend);
  }, [campaignInsightsData, campaigns, goals]);

  // Anuncios que venderam: agrupar por ad_id, filtrar purchases > 0
  type InsightRow = ProcessedMetrics & Record<string, unknown>;
  const baseAdRows = useMemo(() => {
    if (!adInsightsData?.data) return [];
    const insightsList = adInsightsData.data as InsightRow[];

    const byAd = new Map<string, InsightRow[]>();
    for (const row of insightsList) {
      const adId = String(row.ad_id);
      if (!adId || adId === "undefined") continue;
      if (!byAd.has(adId)) byAd.set(adId, []);
      byAd.get(adId)!.push(row);
    }

    return Array.from(byAd.entries())
      .map(([adId, rows]) => {
        const m = aggregateMetrics(rows);
        const firstName = rows[0] ? String(rows[0].ad_name || "") : "";
        return {
          id: adId,
          name: firstName || adId,
          status: "UNKNOWN",
          metrics: m,
        };
      })
      .filter((r) => r.metrics.purchases > 0)
      .sort((a, b) => b.metrics.purchases - a.metrics.purchases);
  }, [adInsightsData]);

  // Fetch thumbnails for ads that sold
  const adIdsWithSales = useMemo(() => baseAdRows.map((r) => r.id), [baseAdRows]);
  const adThumbnails = useThumbnails(adIdsWithSales);

  const adRows = useMemo(() => {
    return baseAdRows.map((r) => ({
      ...r,
      thumbnailUrl: adThumbnails[r.id] || undefined,
    }));
  }, [baseAdRows, adThumbnails]);

  // Gasto do mes atual para o budget tracker
  const { data: monthData } = useInsights(activeAccount, "preset=this_month", undefined, "1");
  const monthSpend = useMemo(() => {
    if (!monthData?.data?.length) return 0;
    return (monthData.data as ProcessedMetrics[]).reduce((sum, d) => sum + d.spend, 0);
  }, [monthData]);

  // Stripe data
  const { data: stripeResponse } = useStripeData(dateQueryString, autoRefreshInterval);
  const stripeData = stripeResponse?.data;

  // Match Stripe campaigns to Facebook campaigns by name
  const campaignRowsWithStripe = useMemo(() => {
    if (!stripeData || !campaignRows.length) return campaignRows;
    return campaignRows.map((row) => {
      const stripeMatch = stripeData.byCampaignName.find((s) =>
        row.name.includes(s.utmCampaign) || s.utmCampaign.includes(row.name) ||
        row.name.startsWith(s.utmCampaign.substring(0, 30))
      );
      return {
        ...row,
        stripeData: stripeMatch ? { sales: stripeMatch.sales, revenue: stripeMatch.revenue } : undefined,
      };
    });
  }, [campaignRows, stripeData]);

  const isLoading = accountsLoading || dailyLoading;
  const accountName = accounts.find((a) => a.id === activeAccount)?.name || "";

  // PDF export data
  const pdfData: PdfExportData | null = useMemo(() => {
    if (isLoading || !metrics.spend) return null;
    return {
      accountName,
      dateRangeLabel: dateRange.customSince && dateRange.customUntil
        ? `${new Date(dateRange.customSince).toLocaleDateString("pt-BR")} a ${new Date(dateRange.customUntil).toLocaleDateString("pt-BR")}`
        : dateRange.preset,
      metrics,
      previousMetrics,
      campaignRows: campaignRows.map((r) => ({ name: r.name, status: r.status, metrics: r.metrics })),
      adRows: adRows.map((r) => ({ name: r.name, metrics: r.metrics })),
    };
  }, [isLoading, accountName, dateRange, metrics, previousMetrics, campaignRows, adRows]);

  return (
    <div>
      <Header
        accounts={accounts}
        selectedAccountId={activeAccount}
        onAccountChange={setSelectedAccountId}
        selectedPreset={dateRange.preset}
        customSince={dateRange.customSince}
        customUntil={dateRange.customUntil}
        onPresetChange={setPreset}
        onCustomChange={setCustomRange}
        autoRefreshInterval={autoRefreshInterval}
        onAutoRefreshChange={setAutoRefreshInterval}
        actions={<ExportButton data={pdfData} />}
        title="Dashboard"
      />

      <div className="p-6 space-y-6">
        {/* Budget Tracker */}
        <BudgetTracker accountId={activeAccount} currentSpend={monthSpend} />

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        ) : (
          <KpiGrid metrics={metrics} previousMetrics={previousMetrics} />
        )}

        {/* Stripe KPI Cards */}
        {stripeData && stripeData.totalSales > 0 && (
          <StripeKpiCards stripeData={stripeData} adSpend={metrics.spend} />
        )}

        {chartData.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Gasto Diario x Vendas
            </h3>
            <SpendAreaChart
              data={chartData}
              label="Gasto"
              dataKey2="value2"
              label2="Vendas"
              formatValue={(v) =>
                v.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })
              }
              formatValue2={(v) => String(Math.round(v))}
            />
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Campanhas
          </h3>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <MetricsTable
              rows={campaignRowsWithStripe}
              onRowClick={(id) =>
                (window.location.href = `/campanha/${id}`)
              }
            />
          )}
        </div>
        {/* Anuncios que venderam */}
        {adRows.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Anuncios que Venderam ({adRows.length})
            </h3>
            <MetricsTable
              rows={adRows}
              onRowClick={(id) =>
                (window.location.href = `/anuncio/${id}`)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
