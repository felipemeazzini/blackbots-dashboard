"use client";

import { useState, useMemo } from "react";
import { useAccounts, useInsights, useAds } from "@/hooks/useFacebookData";
import { useAppContext } from "@/contexts/AppContext";
import { aggregateMetrics, emptyMetrics, formatMetric } from "@/lib/metrics";
import { ProcessedMetrics } from "@/types/metrics";
import Header from "@/components/layout/Header";
import DateRangePicker from "@/components/layout/DateRangePicker";
import { KpiSkeleton } from "@/components/ui/Skeleton";
import AdThumbnail from "@/components/ui/AdThumbnail";
import { Trophy, ChevronDown, ChevronUp, Filter } from "lucide-react";

type InsightRow = ProcessedMetrics & Record<string, unknown>;
type SortKey = "purchases" | "costPerSale" | "roas" | "spend" | "ctr";

export default function RankingPage() {
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

  const { data: adInsights, loading } = useInsights(
    activeAccount, dateQueryString, "ad", "1", autoRefreshInterval
  );
  const { data: adsData } = useAds(activeAccount);

  const [onlySales, setOnlySales] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("costPerSale");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "costPerSale" ? "asc" : "desc"); }
  };

  const rows = useMemo(() => {
    if (!adInsights?.data) return [];
    const insightsList = adInsights.data as InsightRow[];
    const ads = adsData?.data || [];

    const byAd = new Map<string, InsightRow[]>();
    for (const row of insightsList) {
      const adId = String(row.ad_id);
      if (!adId || adId === "undefined") continue;
      if (!byAd.has(adId)) byAd.set(adId, []);
      byAd.get(adId)!.push(row);
    }

    let result = Array.from(byAd.entries()).map(([adId, dailyRows]) => {
      const m = aggregateMetrics(dailyRows);
      const adMeta = ads.find((a) => a.id === adId);
      const campaignName = dailyRows[0] ? String(dailyRows[0].campaign_name || "") : "";
      return {
        id: adId,
        name: adMeta?.name || String(dailyRows[0]?.ad_name || adId),
        campaignName,
        thumbnailUrl: adMeta?.thumbnail_url || undefined,
        metrics: m,
      };
    });

    if (onlySales) result = result.filter((r) => r.metrics.purchases > 0);

    result.sort((a, b) => {
      const aVal = a.metrics[sortKey];
      const bVal = b.metrics[sortKey];
      if (sortKey === "costPerSale") {
        // 0 (no sales) goes to bottom
        if (aVal === 0 && bVal === 0) return 0;
        if (aVal === 0) return 1;
        if (bVal === 0) return -1;
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [adInsights, adsData, onlySales, sortKey, sortDir]);

  // Ranking colors: top 25% green border, bottom 25% red border
  const topThreshold = Math.ceil(rows.length * 0.25);
  const bottomThreshold = rows.length - Math.ceil(rows.length * 0.25);

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      onClick={() => handleSort(k)}
      className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase cursor-pointer hover:text-accent transition-colors whitespace-nowrap"
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        {sortKey === k && (sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
      </div>
    </th>
  );

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
        title="Ranking de Criativos"
      />

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Trophy size={16} className="text-accent" />
          <span className="text-sm text-text-secondary">
            {rows.length} anuncios {onlySales ? "com vendas" : "total"}
          </span>
          <button
            onClick={() => setOnlySales(!onlySales)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              onlySales
                ? "bg-accent text-[#1A1A1A]"
                : "bg-bg-surface text-text-secondary hover:bg-bg-hover"
            }`}
          >
            <Filter size={12} />
            {onlySales ? "Apenas com vendas" : "Todos"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}</div>
        ) : (
          <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-center px-3 py-3 text-xs text-text-muted font-medium uppercase w-8">#</th>
                    <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase">Anuncio</th>
                    <th className="text-left px-3 py-3 text-xs text-text-muted font-medium uppercase">Campanha</th>
                    <SortHeader label="Gasto" k="spend" />
                    <SortHeader label="Vendas" k="purchases" />
                    <SortHeader label="Custo/Venda" k="costPerSale" />
                    <SortHeader label="ROAS" k="roas" />
                    <SortHeader label="CTR" k="ctr" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isTop = i < topThreshold;
                    const isBottom = i >= bottomThreshold && rows.length > 4;
                    const borderColor = isTop ? "border-l-green" : isBottom ? "border-l-red" : "border-l-transparent";

                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-border/50 hover:bg-bg-hover transition-colors border-l-2 ${borderColor}`}
                      >
                        <td className="text-center px-3 py-3 text-text-muted text-xs">{i + 1}</td>
                        <td className="px-4 py-3 text-text-primary font-medium">
                          <div className="flex items-center gap-3">
                            {row.thumbnailUrl && (
                              <AdThumbnail src={row.thumbnailUrl} alt={row.name} size="md" />
                            )}
                            <span className="truncate max-w-[200px]" title={row.name}>{row.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-text-muted text-xs">
                          <span className="truncate max-w-[150px] block" title={row.campaignName}>{row.campaignName}</span>
                        </td>
                        <td className="text-right px-3 py-3 text-text-secondary tabular-nums">
                          {formatMetric(row.metrics.spend, "currency")}
                        </td>
                        <td className="text-right px-3 py-3 text-text-primary tabular-nums font-bold">
                          {row.metrics.purchases}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums font-bold"
                          style={{ color: row.metrics.purchases > 0 ? (row.metrics.costPerSale <= 150 ? "#22c55e" : row.metrics.costPerSale <= 250 ? "#eab308" : "#ef4444") : "#707070" }}
                        >
                          {row.metrics.purchases > 0 ? formatMetric(row.metrics.costPerSale, "currency") : "—"}
                        </td>
                        <td className="text-right px-3 py-3 text-text-secondary tabular-nums">
                          {row.metrics.roas.toFixed(2)}
                        </td>
                        <td className="text-right px-3 py-3 text-text-secondary tabular-nums">
                          {row.metrics.ctr.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-text-muted">
                        Nenhum anuncio encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
