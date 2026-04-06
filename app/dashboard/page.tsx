"use client";

import { useMemo, useEffect } from "react";
import { useAccounts, useInsights, useCampaigns } from "@/hooks/useFacebookData";
import { useAppContext } from "@/contexts/AppContext";
import { useGoals } from "@/hooks/useGoals";
import { aggregateMetrics, emptyMetrics } from "@/lib/metrics";
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
  const accounts = accountsData?.data || [];

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

  const { data: campaignsData } = useCampaigns(activeAccount, undefined, autoRefreshInterval);
  const campaigns = campaignsData?.data || [];

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
        return {
          id: c.id,
          name: c.name,
          status: c.effective_status,
          metrics: rows ? aggregateMetrics(rows) : emptyMetrics(),
        };
      })
      .sort((a, b) => b.metrics.spend - a.metrics.spend);
  }, [campaignInsightsData, campaigns]);

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
          <KpiGrid metrics={metrics} goals={goals} />
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
      </div>
    </div>
  );
}
