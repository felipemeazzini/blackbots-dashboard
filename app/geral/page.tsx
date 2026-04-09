"use client";

import { useMemo } from "react";
import { useInsights, useCampaigns, useAds } from "@/hooks/useFacebookData";
import { useFilteredAccounts } from "@/hooks/useFilteredAccounts";
import { useAppContext } from "@/contexts/AppContext";
import { aggregateMetrics, emptyMetrics, formatMetric } from "@/lib/metrics";
import { ProcessedMetrics } from "@/types/metrics";
import KpiGrid from "@/components/dashboard/KpiGrid";
import MetricsTable from "@/components/dashboard/MetricsTable";
import SpendAreaChart from "@/components/charts/AreaChart";
import DateRangePicker from "@/components/layout/DateRangePicker";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { Building2, RefreshCw } from "lucide-react";

type InsightRow = ProcessedMetrics & Record<string, unknown>;

export default function GeralPage() {
  const {
    dateRange,
    setPreset,
    setCustomRange,
    dateQueryString,
    autoRefreshInterval,
    setAutoRefreshInterval,
  } = useAppContext();

  const { accounts: allAccounts, loading: accountsLoading } = useFilteredAccounts();

  // Insights diarios por conta
  const { data: data0 } = useInsights(allAccounts[0]?.id || null, dateQueryString, undefined, "1", autoRefreshInterval);
  const { data: data1 } = useInsights(allAccounts[1]?.id || null, dateQueryString, undefined, "1", autoRefreshInterval);
  const { data: data2 } = useInsights(allAccounts[2]?.id || null, dateQueryString, undefined, "1", autoRefreshInterval);

  // Insights por campanha por conta
  const { data: camp0 } = useInsights(allAccounts[0]?.id || null, dateQueryString, "campaign", "1", autoRefreshInterval);
  const { data: camp1 } = useInsights(allAccounts[1]?.id || null, dateQueryString, "campaign", "1", autoRefreshInterval);

  // Insights por anuncio por conta
  const { data: ad0 } = useInsights(allAccounts[0]?.id || null, dateQueryString, "ad", "1", autoRefreshInterval);
  const { data: ad1 } = useInsights(allAccounts[1]?.id || null, dateQueryString, "ad", "1", autoRefreshInterval);

  // Campanhas e ads metadata
  const { data: campaigns0 } = useCampaigns(allAccounts[0]?.id || null);
  const { data: campaigns1 } = useCampaigns(allAccounts[1]?.id || null);
  const { data: ads0 } = useAds(allAccounts[0]?.id || null);
  const { data: ads1 } = useAds(allAccounts[1]?.id || null);

  // Metricas por conta
  const accountMetrics = useMemo(() => {
    const datasets = [data0, data1, data2];
    return allAccounts.map((acc, i) => {
      const rows = (datasets[i]?.data || []) as ProcessedMetrics[];
      return {
        id: acc.id,
        name: acc.name,
        currency: acc.currency,
        metrics: rows.length > 0 ? aggregateMetrics(rows) : emptyMetrics(),
        dailyRows: rows,
      };
    });
  }, [allAccounts, data0, data1, data2]);

  // KPIs consolidados
  const totalMetrics: ProcessedMetrics = useMemo(() => {
    const all = accountMetrics.filter((a) => a.metrics.spend > 0);
    if (all.length === 0) return emptyMetrics();
    return aggregateMetrics(all.map((a) => a.metrics));
  }, [accountMetrics]);

  // Grafico consolidado
  const chartData = useMemo(() => {
    const byDate = new Map<string, { spend: number; purchases: number }>();
    for (const acc of accountMetrics) {
      for (const row of acc.dailyRows) {
        const date = row.dateStart || "";
        if (!date) continue;
        const existing = byDate.get(date) || { spend: 0, purchases: 0 };
        existing.spend += row.spend;
        existing.purchases += row.purchases;
        byDate.set(date, existing);
      }
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        value: vals.spend,
        value2: vals.purchases,
      }));
  }, [accountMetrics]);

  // Campanhas consolidadas (todas as contas)
  const campaignRows = useMemo(() => {
    const allCampInsights = [
      ...(camp0?.data || []),
      ...(camp1?.data || []),
    ] as InsightRow[];
    const allCamps = [
      ...(campaigns0?.data || []),
      ...(campaigns1?.data || []),
    ];

    const byCampaign = new Map<string, InsightRow[]>();
    for (const row of allCampInsights) {
      const cid = String(row.campaign_id);
      if (!cid || cid === "undefined") continue;
      if (!byCampaign.has(cid)) byCampaign.set(cid, []);
      byCampaign.get(cid)!.push(row);
    }

    return allCamps
      .map((c) => {
        const rows = byCampaign.get(c.id);
        return {
          id: c.id,
          name: c.name,
          status: c.effective_status,
          metrics: rows ? aggregateMetrics(rows) : emptyMetrics(),
        };
      })
      .filter((r) => r.metrics.spend > 0)
      .sort((a, b) => b.metrics.spend - a.metrics.spend);
  }, [camp0, camp1, campaigns0, campaigns1]);

  // Anuncios que venderam (todas as contas)
  const adRows = useMemo(() => {
    const allAdInsights = [
      ...(ad0?.data || []),
      ...(ad1?.data || []),
    ] as InsightRow[];
    const allAds = [
      ...(ads0?.data || []),
      ...(ads1?.data || []),
    ];

    const byAd = new Map<string, InsightRow[]>();
    for (const row of allAdInsights) {
      const adId = String(row.ad_id);
      if (!adId || adId === "undefined") continue;
      if (!byAd.has(adId)) byAd.set(adId, []);
      byAd.get(adId)!.push(row);
    }

    return Array.from(byAd.entries())
      .map(([adId, rows]) => {
        const m = aggregateMetrics(rows);
        const adMeta = allAds.find((a) => a.id === adId);
        const firstName = rows[0] ? String(rows[0].ad_name || "") : "";
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
  }, [ad0, ad1, ads0, ads1]);

  const isLoading = accountsLoading || (!data0 && allAccounts.length > 0);
  const isAutoRefreshActive = autoRefreshInterval > 0;

  return (
    <div>
      {/* Header com DateRangePicker */}
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Visao Geral
            </h2>
            <p className="text-xs text-text-muted">
              {allAccounts.length} contas consolidadas
            </p>
          </div>
          <div className="flex items-center gap-4">
            <DateRangePicker
              selectedPreset={dateRange.preset}
              customSince={dateRange.customSince}
              customUntil={dateRange.customUntil}
              onPresetChange={setPreset}
              onCustomChange={setCustomRange}
            />
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <RefreshCw
                size={14}
                className={isAutoRefreshActive ? "text-green animate-spin" : "text-text-muted"}
                style={isAutoRefreshActive ? { animationDuration: "3s" } : undefined}
              />
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                <option value={0}>Desligado</option>
                <option value={60000}>1 min</option>
                <option value={300000}>5 min</option>
                <option value={900000}>15 min</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* KPIs consolidados */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        ) : (
          <KpiGrid metrics={totalMetrics} />
        )}

        {/* Grafico consolidado */}
        {chartData.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Gasto Diario x Vendas (Todas as Contas)
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

        {/* Cards por conta */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Resumo por Conta
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {accountMetrics.map((acc) => (
              <div
                key={acc.id}
                className="bg-bg-surface border border-border rounded-xl p-5 hover:border-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Building2 size={16} className="text-accent" />
                  <h4 className="text-sm font-semibold text-text-primary">{acc.name}</h4>
                  <span className="text-[10px] text-text-muted ml-auto">{acc.currency}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Gasto", value: formatMetric(acc.metrics.spend, "currency") },
                    { label: "Vendas", value: String(acc.metrics.purchases) },
                    { label: "Custo/Venda", value: formatMetric(acc.metrics.costPerSale, "currency") },
                    { label: "CPM", value: formatMetric(acc.metrics.cpm, "currency") },
                    { label: "CPC", value: formatMetric(acc.metrics.cpc, "currency") },
                    { label: "ROAS", value: acc.metrics.roas.toFixed(2) },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-[10px] text-text-muted uppercase">{item.label}</p>
                      <p className="text-sm font-bold text-text-primary">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campanhas */}
        {campaignRows.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Campanhas ({campaignRows.length})
            </h3>
            {isLoading ? (
              <TableSkeleton />
            ) : (
              <MetricsTable
                rows={campaignRows}
                onRowClick={(id) => (window.location.href = `/campanha/${id}`)}
              />
            )}
          </div>
        )}

        {/* Anuncios que venderam */}
        {adRows.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Anuncios que Venderam ({adRows.length})
            </h3>
            <MetricsTable
              rows={adRows}
              onRowClick={(id) => (window.location.href = `/anuncio/${id}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
