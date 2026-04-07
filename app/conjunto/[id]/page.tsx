"use client";

import { useMemo, use } from "react";
import { useSearchParams } from "next/navigation";
import {
  useAccounts,
  useInsights,
  useAds,
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

export default function ConjuntoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: adsetId } = use(params);
  const searchParams = useSearchParams();
  const campaignFromUrl = searchParams.get("campaign") || "";

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

  // Buscar TODOS os adsets do account com breakdown diario
  const { data: allAdsetDaily, loading: dailyLoading } = useInsights(
    activeAccount,
    dateQueryString,
    "adset",
    "1",
    autoRefreshInterval
  );

  // Buscar TODOS os ads do account com breakdown diario
  const { data: allAdDaily } = useInsights(
    activeAccount,
    dateQueryString,
    "ad",
    "1",
    autoRefreshInterval
  );

  const { data: adsData, loading: adsLoading } = useAds(activeAccount, adsetId, autoRefreshInterval);
  const ads = adsData?.data || [];


  // Filtrar dados diarios DESTE adset
  const adsetDailyRows = useMemo(() => {
    if (!allAdsetDaily?.data) return [];
    return (allAdsetDaily.data as InsightRow[]).filter(
      (row) => String(row.adset_id) === adsetId
    );
  }, [allAdsetDaily, adsetId]);

  const metrics: ProcessedMetrics = useMemo(() => {
    if (!adsetDailyRows.length) return emptyMetrics();
    return aggregateMetrics(adsetDailyRows);
  }, [adsetDailyRows]);

  const adsetName = useMemo(() => {
    if (!adsetDailyRows.length) return adsetId;
    return (adsetDailyRows[0].adset_name as string) || adsetId;
  }, [adsetDailyRows, adsetId]);

  const chartData = useMemo(() => {
    return adsetDailyRows.map((d) => ({
      date: d.dateStart
        ? new Date(d.dateStart).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })
        : "",
      value: d.spend,
      value2: d.purchases,
    }));
  }, [adsetDailyRows]);

  // Ads: filtrar por adset_id e agrupar por ad_id
  const adRows = useMemo(() => {
    if (!allAdDaily?.data) return [];
    const insightsList = allAdDaily.data as InsightRow[];

    const adsetAds = insightsList.filter(
      (row) => String(row.adset_id) === adsetId
    );

    const byAd = new Map<string, ProcessedMetrics[]>();
    for (const row of adsetAds) {
      const aid = String(row.ad_id);
      if (!aid) continue;
      if (!byAd.has(aid)) byAd.set(aid, []);
      byAd.get(aid)!.push(row);
    }

    return ads.map((a) => {
      const rows = byAd.get(a.id);
      return {
        id: a.id,
        name: a.name,
        status: a.effective_status,
        metrics: rows ? aggregateMetrics(rows) : emptyMetrics(),
        thumbnailUrl: (a as unknown as Record<string, string>).thumbnail_url || undefined,
      };
    });
  }, [allAdDaily, ads, adsetId]);

  const isLoading = dailyLoading || adsLoading;

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
        title={adsetName}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Campanhas", href: "/campanhas" },
          {
            label: "Campanha",
            href: `/campanha/${campaignFromUrl}`,
          },
          { label: adsetName },
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
            Anuncios
          </h3>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <MetricsTable
              rows={adRows}
              onRowClick={(id) =>
                (window.location.href = `/anuncio/${id}?campaign=${campaignFromUrl}&adset=${adsetId}`)
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
