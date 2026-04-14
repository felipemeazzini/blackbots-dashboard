"use client";

import { useState, useMemo } from "react";
import { useRetentionData } from "@/hooks/useRetentionData";
import { useInsights } from "@/hooks/useFacebookData";
import { useFilteredAccounts } from "@/hooks/useFilteredAccounts";
import { useAppContext } from "@/contexts/AppContext";
import { aggregateMetrics, emptyMetrics, formatMetric } from "@/lib/metrics";
import { ProcessedMetrics } from "@/types/metrics";
import { RetentionCampaignData } from "@/types/stripe";
import DateRangePicker from "@/components/layout/DateRangePicker";
import { HeartPulse, Users, TrendingDown, DollarSign, Clock, ChevronDown, ChevronUp } from "lucide-react";

type InsightRow = ProcessedMetrics & Record<string, unknown>;
type SortKey = "totalCustomers" | "activeCustomers" | "churnRate" | "avgLifetimeMonths" | "avgLtv" | "totalLtv" | "cacLifetime" | "cacPeriod" | "ltvCac" | "payback";

export default function RetencaoPage() {
  const { selectedAccountId, setSelectedAccountId, dateRange, setPreset, setCustomRange, dateQueryString } = useAppContext();
  const { accounts } = useFilteredAccounts();
  const activeAccount = selectedAccountId || accounts[0]?.id || "";
  const isAllAccounts = activeAccount === "all";

  const { data: retention, loading } = useRetentionData();

  // Facebook spend LIFETIME (all time) — para CAC Lifetime
  const { data: fbLifetime0 } = useInsights(
    accounts[0]?.id || null, "preset=maximum", "campaign", "1"
  );
  const { data: fbLifetime1 } = useInsights(
    accounts[1]?.id || null, "preset=maximum", "campaign", "1"
  );

  // Facebook spend DO PERIODO selecionado — para CAC do Periodo
  const { data: fbPeriod0 } = useInsights(
    !isAllAccounts ? activeAccount : (accounts[0]?.id || null),
    dateQueryString, "campaign", "1"
  );
  const { data: fbPeriod1 } = useInsights(
    isAllAccounts ? (accounts[1]?.id || null) : null,
    dateQueryString, "campaign", "1"
  );

  const [sortKey, setSortKey] = useState<SortKey>("totalLtv");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  // Helper: compute spend by campaign from insights
  function buildSpendMap(datasets: Array<{ data?: unknown[] } | null>): Map<string, number> {
    const allInsights: InsightRow[] = [];
    for (const ds of datasets) {
      if (ds?.data) allInsights.push(...(ds.data as InsightRow[]));
    }
    if (allInsights.length === 0) return new Map();
    const map = new Map<string, number>();
    const byCamp = new Map<string, InsightRow[]>();
    for (const row of allInsights) {
      const name = String(row.campaign_name || "");
      if (!name) continue;
      if (!byCamp.has(name)) byCamp.set(name, []);
      byCamp.get(name)!.push(row);
    }
    for (const [name, rows] of byCamp) {
      const m = aggregateMetrics(rows);
      map.set(name, m.spend);
    }
    return map;
  }

  // Lifetime spend (all time) — for CAC Lifetime
  const fbSpendLifetime = useMemo(
    () => buildSpendMap([fbLifetime0, fbLifetime1]),
    [fbLifetime0, fbLifetime1]
  );

  // Period spend — for CAC do Periodo
  const fbSpendPeriod = useMemo(
    () => buildSpendMap([fbPeriod0, fbPeriod1]),
    [fbPeriod0, fbPeriod1]
  );

  // Match FB spend to campaign by name
  function matchSpend(utmCampaign: string, spendMap: Map<string, number>): number {
    let total = 0;
    for (const [name, spend] of spendMap) {
      if (name.includes(utmCampaign) || utmCampaign.includes(name) ||
          name.startsWith(utmCampaign.substring(0, 30))) {
        total += spend;
      }
    }
    return total;
  }

  // Period date range for filtering new customers
  const periodStart = dateRange.customSince ? new Date(dateRange.customSince).getTime() : 0;
  const periodEnd = dateRange.customUntil ? new Date(dateRange.customUntil + "T23:59:59").getTime() : Date.now();

  // Enrich retention data with both CACs
  const tableData = useMemo(() => {
    if (!retention) return [];
    return retention.byCampaign.map((camp) => {
      const spendLifetime = matchSpend(camp.utmCampaign, fbSpendLifetime);
      const spendPeriod = matchSpend(camp.utmCampaign, fbSpendPeriod);

      // Count NEW customers acquired in the selected period
      const newCustomersInPeriod = (camp.customerAcquisitionDates || [])
        .filter((ts) => ts >= periodStart && ts <= periodEnd).length;

      const cacLifetime = camp.totalCustomers > 0 ? spendLifetime / camp.totalCustomers : 0;
      const cacPeriod = newCustomersInPeriod > 0 ? spendPeriod / newCustomersInPeriod : 0;
      const ltvCac = cacLifetime > 0 ? camp.avgLtv / cacLifetime : 0;
      const payback = camp.avgMonthlyPrice > 0 ? cacLifetime / camp.avgMonthlyPrice : 0;

      return { ...camp, cacLifetime, cacPeriod, newCustomersInPeriod, ltvCac, payback };
    }).sort((a, b) => {
      const aVal = a[sortKey as keyof typeof a] as number;
      const bVal = b[sortKey as keyof typeof b] as number;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [retention, fbSpendLifetime, fbSpendPeriod, periodStart, periodEnd, sortKey, sortDir]);

  // Total FB spend for overview
  const totalFbSpendLifetime = useMemo(() => {
    let total = 0;
    for (const spend of fbSpendLifetime.values()) total += spend;
    return total;
  }, [fbSpendLifetime]);

  const totalFbSpendPeriod = useMemo(() => {
    let total = 0;
    for (const spend of fbSpendPeriod.values()) total += spend;
    return total;
  }, [fbSpendPeriod]);

  const overviewCacLifetime = retention && retention.overview.totalSubscribers > 0
    ? totalFbSpendLifetime / retention.overview.totalSubscribers : 0;
  const overviewLtvCac = overviewCacLifetime > 0 && retention
    ? retention.overview.avgLtv / overviewCacLifetime : 0;

  const SortHeader = ({ label, k, color }: { label: string; k: SortKey; color?: string }) => (
    <th
      onClick={() => handleSort(k)}
      className={`text-right px-3 py-3 text-xs font-medium uppercase cursor-pointer hover:text-accent transition-colors whitespace-nowrap ${color || "text-text-muted"}`}
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        {sortKey === k && (sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
      </div>
    </th>
  );

  return (
    <div>
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse size={20} className="text-green" />
            <h2 className="text-lg font-semibold text-text-primary">Retencao / LTV</h2>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={activeAccount}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary max-w-[280px]"
            >
              <option value="all">Todas as contas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <DateRangePicker
              selectedPreset={dateRange.preset}
              customSince={dateRange.customSince}
              customUntil={dateRange.customUntil}
              onPresetChange={setPreset}
              onCustomChange={setCustomRange}
            />
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {loading && !retention && (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm">Sincronizando dados do Stripe...</p>
            <p className="text-xs text-text-muted mt-1">Primeira carga pode demorar alguns segundos</p>
          </div>
        )}
        {retention ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "TOTAL ASSINANTES", value: String(retention.overview.totalSubscribers), icon: Users, color: "#F5F5F5" },
                { label: "ATIVOS", value: String(retention.overview.activeSubscribers), icon: HeartPulse, color: "#22C55E" },
                { label: "CHURN MENSAL", value: `${retention.overview.monthlyChurnRate.toFixed(1)}%`, icon: TrendingDown, color: retention.overview.monthlyChurnRate > 10 ? "#EF4444" : "#F5A623" },
                { label: "LTV MEDIO", value: formatMetric(retention.overview.avgLtv, "currency"), icon: DollarSign, color: "#A855F7" },
                { label: "TEMPO MEDIO", value: `${retention.overview.avgLifetimeMonths.toFixed(1)} meses`, icon: Clock, color: "#F5A623" },
                { label: "LTV/CAC", value: overviewLtvCac.toFixed(1) + "x", icon: DollarSign, color: overviewLtvCac >= 3 ? "#22C55E" : overviewLtvCac >= 1 ? "#F5A623" : "#EF4444" },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="bg-bg-surface border border-border rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon size={12} style={{ color: card.color }} />
                      <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">{card.label}</span>
                    </div>
                    <span className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</span>
                  </div>
                );
              })}
            </div>

            {/* Metricas Ajustadas */}
            <div className="bg-bg-surface border border-green/20 rounded-xl p-5">
              <h3 className="text-sm font-medium text-green mb-3">Metricas Ajustadas com LTV</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-[10px] text-text-muted uppercase">CAC Lifetime</p>
                  <p className="text-xs text-text-muted mb-1">Gasto total FB / total clientes</p>
                  <p className="text-lg font-bold text-text-primary">{formatMetric(overviewCacLifetime, "currency")}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">LTV Medio</p>
                  <p className="text-xs text-text-muted mb-1">Receita real por cliente</p>
                  <p className="text-lg font-bold text-purple">{formatMetric(retention.overview.avgLtv, "currency")}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">LTV/CAC</p>
                  <p className="text-xs text-text-muted mb-1">Saudavel se {">"}= 3x</p>
                  <p className="text-lg font-bold" style={{ color: overviewLtvCac >= 3 ? "#22C55E" : overviewLtvCac >= 1 ? "#F5A623" : "#EF4444" }}>
                    {overviewLtvCac > 0 ? overviewLtvCac.toFixed(1) + "x" : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">ROAS com LTV</p>
                  <p className="text-xs text-text-muted mb-1">LTV total / gasto total FB</p>
                  <p className="text-lg font-bold" style={{ color: overviewLtvCac >= 1 ? "#22C55E" : "#EF4444" }}>
                    {totalFbSpendLifetime > 0 ? ((retention.overview.avgLtv * retention.overview.totalSubscribers) / totalFbSpendLifetime).toFixed(2) : "—"}x
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Payback</p>
                  <p className="text-xs text-text-muted mb-1">Meses pra recuperar CAC</p>
                  <p className="text-lg font-bold text-accent">
                    {retention.overview.avgMonthlyPrice > 0 && overviewCacLifetime > 0 ? (overviewCacLifetime / retention.overview.avgMonthlyPrice).toFixed(1) : "—"} meses
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela por campanha */}
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3">
                Retencao por Campanha ({tableData.length})
              </h3>
              <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase">Campanha</th>
                        <SortHeader label="Clientes" k="totalCustomers" />
                        <SortHeader label="Ativos" k="activeCustomers" color="text-green" />
                        <SortHeader label="Churn%" k="churnRate" />
                        <SortHeader label="Tempo" k="avgLifetimeMonths" />
                        <SortHeader label="LTV Medio" k="avgLtv" color="text-purple" />
                        <SortHeader label="LTV Total" k="totalLtv" color="text-purple" />
                        <SortHeader label="CAC Life" k="cacLifetime" />
                        <SortHeader label="CAC Periodo" k="cacPeriod" />
                        <SortHeader label="LTV/CAC" k="ltvCac" />
                        <SortHeader label="Payback" k="payback" />
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((c) => {
                        const ltvColor = c.ltvCac >= 3 ? "#22C55E" : c.ltvCac >= 1 ? "#F5A623" : "#EF4444";
                        return (
                          <tr key={c.utmCampaign} className="border-b border-border/50 hover:bg-bg-hover">
                            <td className="px-4 py-3 text-text-primary font-medium">
                              <span className="truncate max-w-[200px] block" title={c.utmCampaign}>{c.utmCampaign}</span>
                            </td>
                            <td className="text-right px-3 py-3 text-text-secondary tabular-nums">{c.totalCustomers}</td>
                            <td className="text-right px-3 py-3 text-green tabular-nums font-medium">{c.activeCustomers}</td>
                            <td className="text-right px-3 py-3 tabular-nums" style={{ color: c.churnRate > 50 ? "#EF4444" : "#B0B0B0" }}>
                              {c.churnRate.toFixed(0)}%
                            </td>
                            <td className="text-right px-3 py-3 text-text-secondary tabular-nums">
                              {c.avgLifetimeMonths.toFixed(1)}m
                            </td>
                            <td className="text-right px-3 py-3 text-purple tabular-nums font-bold">
                              {formatMetric(c.avgLtv, "currency")}
                            </td>
                            <td className="text-right px-3 py-3 text-purple tabular-nums font-bold">
                              {formatMetric(c.totalLtv, "currency")}
                            </td>
                            <td className="text-right px-3 py-3 text-text-secondary tabular-nums">
                              {c.cacLifetime > 0 ? formatMetric(c.cacLifetime, "currency") : "—"}
                            </td>
                            <td className="text-right px-3 py-3 text-text-muted tabular-nums">
                              {c.cacPeriod > 0 ? formatMetric(c.cacPeriod, "currency") : "—"}
                              {c.newCustomersInPeriod > 0 && (
                                <span className="block text-[9px] text-text-muted">{c.newCustomersInPeriod} novos</span>
                              )}
                            </td>
                            <td className="text-right px-3 py-3 tabular-nums font-bold" style={{ color: ltvColor }}>
                              {c.ltvCac > 0 ? c.ltvCac.toFixed(1) + "x" : "—"}
                            </td>
                            <td className="text-right px-3 py-3 text-text-secondary tabular-nums">
                              {c.payback > 0 ? c.payback.toFixed(1) + "m" : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : !loading ? (
          <p className="text-text-muted text-center py-12">Nenhum dado de retencao disponivel</p>
        ) : null}
      </div>
    </div>
  );
}
