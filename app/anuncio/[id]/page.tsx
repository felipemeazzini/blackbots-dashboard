"use client";

import { useMemo, use } from "react";
import { useSearchParams } from "next/navigation";
import { useAccounts, useInsights, useAds } from "@/hooks/useFacebookData";
import { useAppContext } from "@/contexts/AppContext";
import { useGoals } from "@/hooks/useGoals";
import { aggregateMetrics, emptyMetrics } from "@/lib/metrics";
import { ProcessedMetrics } from "@/types/metrics";
import Header from "@/components/layout/Header";
import KpiGrid from "@/components/dashboard/KpiGrid";
import SpendAreaChart from "@/components/charts/AreaChart";
import { KpiSkeleton } from "@/components/ui/Skeleton";

type InsightRow = ProcessedMetrics & Record<string, unknown>;

export default function AnuncioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: adId } = use(params);
  const searchParams = useSearchParams();
  const campaignFromUrl = searchParams.get("campaign") || "";
  const adsetFromUrl = searchParams.get("adset") || "";

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

  const { data: allAdDaily, loading: dailyLoading } = useInsights(
    activeAccount,
    dateQueryString,
    "ad",
    "1",
    autoRefreshInterval
  );

  // Buscar dados do ad (com thumbnail)
  const { data: adsData } = useAds(activeAccount, adsetFromUrl || undefined);

  const { goals } = useGoals(activeAccount);

  const adDailyRows = useMemo(() => {
    if (!allAdDaily?.data) return [];
    return (allAdDaily.data as InsightRow[]).filter(
      (row) => String(row.ad_id) === adId
    );
  }, [allAdDaily, adId]);

  const metrics: ProcessedMetrics = useMemo(() => {
    if (!adDailyRows.length) return emptyMetrics();
    return aggregateMetrics(adDailyRows);
  }, [adDailyRows]);

  const adName = useMemo(() => {
    if (!adDailyRows.length) return adId;
    return (adDailyRows[0].ad_name as string) || adId;
  }, [adDailyRows, adId]);

  const thumbnailUrl = useMemo(() => {
    const ad = adsData?.data?.find((a) => a.id === adId);
    return ad?.thumbnail_url || null;
  }, [adsData, adId]);

  const chartData = useMemo(() => {
    return adDailyRows.map((d) => ({
      date: d.dateStart
        ? new Date(d.dateStart).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })
        : "",
      value: d.spend,
      value2: d.purchases,
    }));
  }, [adDailyRows]);

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
        title={adName}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Campanhas", href: "/campanhas" },
          {
            label: "Campanha",
            href: `/campanha/${campaignFromUrl}`,
          },
          {
            label: "Conjunto",
            href: `/conjunto/${adsetFromUrl}?campaign=${campaignFromUrl}`,
          },
          { label: adName },
        ]}
      />

      <div className="p-6 space-y-6">
        {/* Preview do anuncio */}
        {thumbnailUrl && (
          <div className="flex items-start gap-6">
            <img
              src={thumbnailUrl}
              alt={adName}
              className="w-32 h-32 rounded-xl object-cover bg-bg-hover border border-border"
            />
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{adName}</h3>
              <p className="text-sm text-text-muted mt-1">ID: {adId}</p>
            </div>
          </div>
        )}

        {dailyLoading ? (
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
              Performance Diaria
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
      </div>
    </div>
  );
}
