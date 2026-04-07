"use client";

import { useMemo, useEffect } from "react";
import { useAccounts, useInsights, useCampaigns, useAds } from "@/hooks/useFacebookData";
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
  } = useAppContext();

  const { data: accountsData, loading: accountsLoading } = useAccounts();
  const accounts = (accountsData?.data || []).filter(
    (a) => Number(a.amount_spent) > 0 && !a.name.includes("Read-Only") && !a.name.includes("Test ")
  );

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

  // Metadados dos anuncios (nome, thumbnail)
  const { data: adsData } = useAds(activeAccount);

  const { goals } = useGoals(activeAccount);

  // KPIs: agregar dados diarios
  const metrics: ProcessedMetrics = useMemo(() => {
    if (!dailyData?.data?.length) return emptyMetrics();
    return aggregateMetrics(dailyData.data as ProcessedMetrics[]);
  }, [dailyData]);

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
        const costGoal = goals.find((g) => g.campaign_id === c.id && g.metric === "cost_per_purchase");
        const goalStatus = costGoal
          ? getGoalStatus(m.costPerSale, costGoal, m.purchases)
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
  const adRows = useMemo(() => {
    if (!adInsightsData?.data) return [];
    const insightsList = adInsightsData.data as InsightRow[];
    const ads = adsData?.data || [];

    const byAd = new Map<string, ProcessedMetrics[]>();
    for (const row of insightsList) {
      const adId = String(row.ad_id);
      if (!adId || adId === "undefined") continue;
      if (!byAd.has(adId)) byAd.set(adId, []);
      byAd.get(adId)!.push(row);
    }

    return Array.from(byAd.entries())
      .map(([adId, rows]) => {
        const m = aggregateMetrics(rows);
        const adMeta = ads.find((a) => a.id === adId);
        // Get ad_name from first insight row
        const firstName = rows[0] ? String((rows[0] as InsightRow).ad_name || "") : "";
        return {
          id: adId,
          name: adMeta?.name || firstName || adId,
          status: adMeta?.effective_status || "UNKNOWN",
          metrics: m,
          thumbnailUrl: adMeta?.thumbnail_url || undefined,
        };
      })
      .filter((r) => r.metrics.purchases > 0)
      .sort((a, b) => b.metrics.purchases - a.metrics.purchases);
  }, [adInsightsData, adsData]);

  const isLoading = accountsLoading || dailyLoading;

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
        title="Dashboard"
      />

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        ) : (
          <KpiGrid metrics={metrics} />
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
              rows={campaignRows}
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
