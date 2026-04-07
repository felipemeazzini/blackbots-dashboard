"use client";

import { useMemo, use } from "react";
import {
  useAccounts,
  useInsights,
  useAdSets,
} from "@/hooks/useFacebookData";
import { useAppContext } from "@/contexts/AppContext";
import { aggregateMetrics, emptyMetrics } from "@/lib/metrics";
import { ProcessedMetrics } from "@/types/metrics";
import Header from "@/components/layout/Header";
import KpiGrid from "@/components/dashboard/KpiGrid";
import MetricsTable from "@/components/dashboard/MetricsTable";
import SpendAreaChart from "@/components/charts/AreaChart";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

type InsightRow = ProcessedMetrics & Record<string, unknown>;

export default function CampanhaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
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

  const { data: accountsData } = useAccounts();
  const accounts = (accountsData?.data || []).filter(
    (a) => Number(a.amount_spent) > 0 && !a.name.includes("Read-Only") && !a.name.includes("Test ")
  );
  const activeAccount = selectedAccountId || accounts[0]?.id || "";

  // Buscar TODAS as campanhas do account com breakdown diario
  const { data: allCampaignDaily, loading: dailyLoading } = useInsights(
    activeAccount,
    dateQueryString,
    "campaign",
    "1",
    autoRefreshInterval
  );

  // Buscar TODOS os adsets do account com breakdown diario
  const { data: allAdsetDaily } = useInsights(
    activeAccount,
    dateQueryString,
    "adset",
    "1",
    autoRefreshInterval
  );

  const { data: adsetsData, loading: adsetsLoading } = useAdSets(
    activeAccount,
    campaignId,
    autoRefreshInterval
  );
  const adsets = adsetsData?.data || [];


  // Filtrar dados diarios DESTA campanha
  const campaignDailyRows = useMemo(() => {
    if (!allCampaignDaily?.data) return [];
    return (allCampaignDaily.data as InsightRow[]).filter(
      (row) => String(row.campaign_id) === campaignId
    );
  }, [allCampaignDaily, campaignId]);

  // KPIs agregados
  const metrics: ProcessedMetrics = useMemo(() => {
    if (!campaignDailyRows.length) return emptyMetrics();
    return aggregateMetrics(campaignDailyRows);
  }, [campaignDailyRows]);

  // Nome da campanha
  const campaignName = useMemo(() => {
    if (!campaignDailyRows.length) return campaignId;
    return (campaignDailyRows[0].campaign_name as string) || campaignId;
  }, [campaignDailyRows, campaignId]);

  // Grafico diario
  const chartData = useMemo(() => {
    return campaignDailyRows.map((d) => ({
      date: d.dateStart
        ? new Date(d.dateStart).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })
        : "",
      value: d.spend,
      value2: d.purchases,
    }));
  }, [campaignDailyRows]);

  // Adsets: filtrar por campaign_id e agrupar por adset_id
  const adsetRows = useMemo(() => {
    if (!allAdsetDaily?.data) return [];
    const insightsList = allAdsetDaily.data as InsightRow[];

    // Filtrar adsets desta campanha
    const campaignAdsets = insightsList.filter(
      (row) => String(row.campaign_id) === campaignId
    );

    // Agrupar por adset_id
    const byAdset = new Map<string, ProcessedMetrics[]>();
    for (const row of campaignAdsets) {
      const aid = String(row.adset_id);
      if (!aid) continue;
      if (!byAdset.has(aid)) byAdset.set(aid, []);
      byAdset.get(aid)!.push(row);
    }

    return adsets.map((a) => {
      const rows = byAdset.get(a.id);
      return {
        id: a.id,
        name: a.name,
        status: a.effective_status,
        metrics: rows ? aggregateMetrics(rows) : emptyMetrics(),
      };
    });
  }, [allAdsetDaily, adsets, campaignId]);

  const isLoading = dailyLoading || adsetsLoading;

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
        title={campaignName}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Campanhas", href: "/campanhas" },
          { label: campaignName },
        ]}
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
                v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              }
              formatValue2={(v) => String(Math.round(v))}
            />
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Conjuntos de Anuncios
          </h3>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <MetricsTable
              rows={adsetRows}
              onRowClick={(id) =>
                (window.location.href = `/conjunto/${id}?campaign=${campaignId}`)
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
