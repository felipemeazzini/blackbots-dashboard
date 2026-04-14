"use client";

import { useState, useMemo } from "react";
import { useRetentionData } from "@/hooks/useRetentionData";
import { useInsights, useCampaigns } from "@/hooks/useFacebookData";
import { useFilteredAccounts } from "@/hooks/useFilteredAccounts";
import { useAppContext } from "@/contexts/AppContext";
import { aggregateMetrics, formatMetric } from "@/lib/metrics";
import { ProcessedMetrics } from "@/types/metrics";
import { StripeSubscriptionData } from "@/types/stripe";
import DateRangePicker from "@/components/layout/DateRangePicker";
import { HeartPulse, Users, TrendingDown, DollarSign, Clock, ChevronDown, ChevronRight, Zap, Leaf } from "lucide-react";

type InsightRow = ProcessedMetrics & Record<string, unknown>;

// Helper: aggregate subscriptions into metrics
function aggregateSubs(subs: StripeSubscriptionData[]) {
  const total = subs.length;
  if (total === 0) return { total: 0, active: 0, canceled: 0, churnRate: 0, avgLtv: 0, totalLtv: 0, avgLifetimeMonths: 0, avgMonthlyPrice: 0 };
  const active = subs.filter((s) => s.isActive).length;
  const canceled = total - active;
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86400 * 1000;
  const recentCancels = subs.filter((s) => !s.isActive && s.lastPaid > thirtyDaysAgo).length;
  const churnRate = active > 0 ? (recentCancels / (active + recentCancels)) * 100 : 0;
  const avgLtv = subs.reduce((s, d) => s + d.totalPaid, 0) / total;
  const totalLtv = subs.reduce((s, d) => s + d.totalPaid, 0);
  const avgLifetimeDays = subs.reduce((s, d) => s + d.lifetimeDays, 0) / total;
  const avgMonthlyPrice = subs.reduce((s, d) => s + d.totalPaid / Math.max(d.invoiceCount, 1), 0) / total;
  return { total, active, canceled, churnRate, avgLtv, totalLtv, avgLifetimeMonths: avgLifetimeDays / 30, avgMonthlyPrice };
}

export default function RetencaoPage() {
  const { dateRange, setPreset, setCustomRange, dateQueryString } = useAppContext();
  const { accounts } = useFilteredAccounts();

  const { subscriptions, loading } = useRetentionData();

  // Facebook campaigns per account (for name -> account mapping)
  const { data: campaigns0 } = useCampaigns(accounts[0]?.id || null);
  const { data: campaigns1 } = useCampaigns(accounts[1]?.id || null);

  // Facebook spend LIFETIME per account (last 90d covers active campaign period)
  const { data: fbAll0 } = useInsights(accounts[0]?.id || null, "preset=last_90d", "campaign", "1");
  const { data: fbAll1 } = useInsights(accounts[1]?.id || null, "preset=last_90d", "campaign", "1");

  // Facebook spend DO PERIODO per account
  const { data: fbPeriod0 } = useInsights(accounts[0]?.id || null, dateQueryString, "campaign", "1");
  const { data: fbPeriod1 } = useInsights(accounts[1]?.id || null, dateQueryString, "campaign", "1");

  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  // Build campaign name -> account mapping from CAMPAIGNS API (exact match with Stripe utm)
  const campaignAccountMap = useMemo(() => {
    const map = new Map<string, { accountId: string; accountName: string }>();
    for (let i = 0; i < accounts.length; i++) {
      const camps = i === 0 ? campaigns0?.data : campaigns1?.data;
      if (!camps) continue;
      for (const camp of camps) {
        map.set(camp.name, { accountId: accounts[i].id, accountName: accounts[i].name });
      }
    }
    return map;
  }, [accounts, campaigns0, campaigns1]);

  // Build spend maps
  function buildSpendMap(datasets: Array<{ data?: unknown[] } | null>): Map<string, number> {
    const map = new Map<string, number>();
    for (const ds of datasets) {
      if (!ds?.data) continue;
      const byCamp = new Map<string, InsightRow[]>();
      for (const row of ds.data as InsightRow[]) {
        const name = String(row.campaign_name || "");
        if (!name) continue;
        if (!byCamp.has(name)) byCamp.set(name, []);
        byCamp.get(name)!.push(row);
      }
      for (const [name, rows] of byCamp) {
        const m = aggregateMetrics(rows);
        map.set(name, (map.get(name) || 0) + m.spend);
      }
    }
    return map;
  }

  const fbSpendLifetime = useMemo(() => buildSpendMap([fbAll0, fbAll1]), [fbAll0, fbAll1]);
  const fbSpendPeriod = useMemo(() => buildSpendMap([fbPeriod0, fbPeriod1]), [fbPeriod0, fbPeriod1]);

  // Period dates
  const periodStart = dateRange.customSince ? new Date(dateRange.customSince).getTime() : 0;
  const periodEnd = dateRange.customUntil ? new Date(dateRange.customUntil + "T23:59:59").getTime() : Date.now();
  const isAllTime = dateRange.preset === "maximum" || !periodStart;

  // Filter subscriptions by period (acquired in period)
  const filteredSubs = useMemo(() => {
    if (isAllTime) return subscriptions;
    return subscriptions.filter((s) => s.firstPaid >= periodStart && s.firstPaid <= periodEnd);
  }, [subscriptions, periodStart, periodEnd, isAllTime]);

  // Match utm_campaign to account — exact first, then fuzzy
  function matchAccount(utmCampaign: string): { accountId: string; accountName: string } | null {
    // Exact match
    const exact = campaignAccountMap.get(utmCampaign);
    if (exact) return exact;
    // Fuzzy match
    for (const [name, acc] of campaignAccountMap) {
      if (name.includes(utmCampaign) || utmCampaign.includes(name) ||
          (utmCampaign.length > 20 && name.startsWith(utmCampaign.substring(0, 20)))) {
        return acc;
      }
    }
    return null;
  }

  function matchSpend(utmCampaign: string, spendMap: Map<string, number>): number {
    let total = 0;
    for (const [name, spend] of spendMap) {
      if (name.includes(utmCampaign) || utmCampaign.includes(name) || name.startsWith(utmCampaign.substring(0, 30))) {
        total += spend;
      }
    }
    return total;
  }

  // Separate organic vs paid
  const organicSubs = useMemo(() => filteredSubs.filter((s) => s.utmCampaign === "Direto / Organico"), [filteredSubs]);
  const paidSubs = useMemo(() => filteredSubs.filter((s) => s.utmCampaign !== "Direto / Organico"), [filteredSubs]);

  // Group paid subs by account
  const byAccount = useMemo(() => {
    const map = new Map<string, { accountName: string; subs: StripeSubscriptionData[] }>();
    for (const sub of paidSubs) {
      const acc = matchAccount(sub.utmCampaign);
      const key = acc?.accountId || "unknown";
      const name = acc?.accountName || "Outras Campanhas";
      if (!map.has(key)) map.set(key, { accountName: name, subs: [] });
      map.get(key)!.subs.push(sub);
    }
    return Array.from(map.entries()).map(([accountId, data]) => ({
      accountId,
      accountName: data.accountName,
      subs: data.subs,
      metrics: aggregateSubs(data.subs),
    })).sort((a, b) => b.metrics.totalLtv - a.metrics.totalLtv);
  }, [paidSubs, campaignAccountMap]);

  // Group by campaign within an account
  function getCampaignRows(subs: StripeSubscriptionData[]) {
    const byCamp = new Map<string, StripeSubscriptionData[]>();
    for (const sub of subs) {
      if (!byCamp.has(sub.utmCampaign)) byCamp.set(sub.utmCampaign, []);
      byCamp.get(sub.utmCampaign)!.push(sub);
    }
    return Array.from(byCamp.entries()).map(([utmCampaign, campSubs]) => {
      const m = aggregateSubs(campSubs);
      const spend = isAllTime ? matchSpend(utmCampaign, fbSpendLifetime) : matchSpend(utmCampaign, fbSpendPeriod);
      const cac = m.total > 0 ? spend / m.total : 0;
      const ltvCac = cac > 0 ? m.avgLtv / cac : 0;
      return { utmCampaign, ...m, spend, cac, ltvCac };
    }).sort((a, b) => b.totalLtv - a.totalLtv);
  }

  // Overall metrics
  const overallMetrics = aggregateSubs(filteredSubs);
  const organicMetrics = aggregateSubs(organicSubs);
  const paidMetrics = aggregateSubs(paidSubs);

  const totalSpend = isAllTime
    ? Array.from(fbSpendLifetime.values()).reduce((s, v) => s + v, 0)
    : Array.from(fbSpendPeriod.values()).reduce((s, v) => s + v, 0);
  const paidCac = paidMetrics.total > 0 ? totalSpend / paidMetrics.total : 0;
  const paidLtvCac = paidCac > 0 ? paidMetrics.avgLtv / paidCac : 0;

  const ltvCacColor = (v: number) => v >= 3 ? "#22C55E" : v >= 1 ? "#F5A623" : "#EF4444";

  return (
    <div>
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse size={20} className="text-green" />
            <h2 className="text-lg font-semibold text-text-primary">Retencao / LTV</h2>
          </div>
          <DateRangePicker
            selectedPreset={dateRange.preset}
            customSince={dateRange.customSince}
            customUntil={dateRange.customUntil}
            onPresetChange={setPreset}
            onCustomChange={setCustomRange}
          />
        </div>
      </header>

      <div className="p-6 space-y-6">
        {loading && subscriptions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm">Sincronizando dados do Stripe...</p>
          </div>
        ) : (
          <>
            {/* KPIs Totais */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "TOTAL ASSINANTES", value: String(overallMetrics.total), icon: Users, color: "#F5F5F5" },
                { label: "ATIVOS", value: String(overallMetrics.active), icon: HeartPulse, color: "#22C55E" },
                { label: "CHURN MENSAL", value: `${overallMetrics.churnRate.toFixed(1)}%`, icon: TrendingDown, color: overallMetrics.churnRate > 10 ? "#EF4444" : "#F5A623" },
                { label: "LTV MEDIO", value: formatMetric(overallMetrics.avgLtv, "currency"), icon: DollarSign, color: "#A855F7" },
                { label: "TEMPO MEDIO", value: `${overallMetrics.avgLifetimeMonths.toFixed(1)} meses`, icon: Clock, color: "#F5A623" },
                { label: "RECEITA TOTAL", value: formatMetric(overallMetrics.totalLtv, "currency"), icon: DollarSign, color: "#22C55E" },
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

            {/* Trafego Pago vs Organico */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Trafego Pago */}
              <div className="bg-bg-surface border border-accent/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={16} className="text-accent" />
                  <span className="text-sm font-semibold text-accent">Trafego Pago</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Clientes</p>
                    <p className="text-lg font-bold text-text-primary">{paidMetrics.total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Ativos</p>
                    <p className="text-lg font-bold text-green">{paidMetrics.active}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">LTV Medio</p>
                    <p className="text-lg font-bold text-purple">{formatMetric(paidMetrics.avgLtv, "currency")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">CAC</p>
                    <p className="text-lg font-bold text-text-primary">{paidCac > 0 ? formatMetric(paidCac, "currency") : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">LTV/CAC</p>
                    <p className="text-lg font-bold" style={{ color: ltvCacColor(paidLtvCac) }}>
                      {paidLtvCac > 0 ? paidLtvCac.toFixed(1) + "x" : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Gasto Total FB</p>
                    <p className="text-lg font-bold text-accent">{formatMetric(totalSpend, "currency")}</p>
                  </div>
                </div>
              </div>

              {/* Organico */}
              <div className="bg-bg-surface border border-green/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Leaf size={16} className="text-green" />
                  <span className="text-sm font-semibold text-green">Direto / Organico</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Clientes</p>
                    <p className="text-lg font-bold text-text-primary">{organicMetrics.total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Ativos</p>
                    <p className="text-lg font-bold text-green">{organicMetrics.active}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">LTV Medio</p>
                    <p className="text-lg font-bold text-purple">{formatMetric(organicMetrics.avgLtv, "currency")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Tempo Medio</p>
                    <p className="text-lg font-bold text-accent">{organicMetrics.avgLifetimeMonths.toFixed(1)}m</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Churn</p>
                    <p className="text-lg font-bold" style={{ color: organicMetrics.churnRate > 10 ? "#EF4444" : "#F5A623" }}>
                      {organicMetrics.churnRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Receita Total</p>
                    <p className="text-lg font-bold text-green">{formatMetric(organicMetrics.totalLtv, "currency")}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Retencao por Conta de Anuncio */}
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3">Retencao por Conta de Anuncio</h3>
              <div className="space-y-3">
                {byAccount.map((acc) => {
                  const isExpanded = expandedAccount === acc.accountId;
                  const accSpend = isAllTime
                    ? acc.subs.reduce((s, sub) => s + matchSpend(sub.utmCampaign, fbSpendLifetime), 0)
                    : acc.subs.reduce((s, sub) => s + matchSpend(sub.utmCampaign, fbSpendPeriod), 0);
                  const accCac = acc.metrics.total > 0 ? accSpend / acc.metrics.total : 0;
                  const accLtvCac = accCac > 0 ? acc.metrics.avgLtv / accCac : 0;

                  return (
                    <div key={acc.accountId} className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                      {/* Account header */}
                      <button
                        onClick={() => setExpandedAccount(isExpanded ? null : acc.accountId)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-bg-hover transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown size={16} className="text-accent" /> : <ChevronRight size={16} className="text-text-muted" />}
                          <span className="text-sm font-semibold text-text-primary">{acc.accountName}</span>
                        </div>
                        <div className="flex items-center gap-6 text-xs">
                          <span className="text-accent font-bold">Gasto {formatMetric(accSpend, "currency")}</span>
                          <span className="text-text-muted">{acc.metrics.total} clientes</span>
                          <span className="text-green">{acc.metrics.active} ativos</span>
                          <span className="text-purple font-bold">LTV {formatMetric(acc.metrics.avgLtv, "currency")}</span>
                          <span className="text-text-secondary">CAC {accCac > 0 ? formatMetric(accCac, "currency") : "—"}</span>
                          <span className="font-bold" style={{ color: ltvCacColor(accLtvCac) }}>
                            {accLtvCac > 0 ? accLtvCac.toFixed(1) + "x" : "—"}
                          </span>
                        </div>
                      </button>

                      {/* Expanded: campaign table */}
                      {isExpanded && (
                        <div className="border-t border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/50">
                                <th className="text-left px-4 py-2 text-xs text-text-muted font-medium uppercase">Campanha</th>
                                <th className="text-right px-3 py-2 text-xs text-accent font-medium uppercase">Gasto</th>
                                <th className="text-right px-3 py-2 text-xs text-text-muted font-medium uppercase">Clientes</th>
                                <th className="text-right px-3 py-2 text-xs text-green font-medium uppercase">Ativos</th>
                                <th className="text-right px-3 py-2 text-xs text-text-muted font-medium uppercase">Churn%</th>
                                <th className="text-right px-3 py-2 text-xs text-text-muted font-medium uppercase">Tempo</th>
                                <th className="text-right px-3 py-2 text-xs text-purple font-medium uppercase">LTV Med</th>
                                <th className="text-right px-3 py-2 text-xs text-purple font-medium uppercase">LTV Total</th>
                                <th className="text-right px-3 py-2 text-xs text-text-muted font-medium uppercase">CAC</th>
                                <th className="text-right px-3 py-2 text-xs text-text-muted font-medium uppercase">LTV/CAC</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getCampaignRows(acc.subs).map((c) => (
                                <tr key={c.utmCampaign} className="border-b border-border/30 hover:bg-bg-hover">
                                  <td className="px-4 py-2 text-text-primary">
                                    <span className="truncate max-w-[200px] block" title={c.utmCampaign}>{c.utmCampaign}</span>
                                  </td>
                                  <td className="text-right px-3 py-2 text-accent tabular-nums font-bold">{c.spend > 0 ? formatMetric(c.spend, "currency") : "—"}</td>
                                  <td className="text-right px-3 py-2 text-text-secondary tabular-nums">{c.total}</td>
                                  <td className="text-right px-3 py-2 text-green tabular-nums">{c.active}</td>
                                  <td className="text-right px-3 py-2 text-text-secondary tabular-nums">{c.churnRate.toFixed(0)}%</td>
                                  <td className="text-right px-3 py-2 text-text-secondary tabular-nums">{c.avgLifetimeMonths.toFixed(1)}m</td>
                                  <td className="text-right px-3 py-2 text-purple tabular-nums font-bold">{formatMetric(c.avgLtv, "currency")}</td>
                                  <td className="text-right px-3 py-2 text-purple tabular-nums font-bold">{formatMetric(c.totalLtv, "currency")}</td>
                                  <td className="text-right px-3 py-2 text-text-secondary tabular-nums">{c.cac > 0 ? formatMetric(c.cac, "currency") : "—"}</td>
                                  <td className="text-right px-3 py-2 tabular-nums font-bold" style={{ color: ltvCacColor(c.ltvCac) }}>
                                    {c.ltvCac > 0 ? c.ltvCac.toFixed(1) + "x" : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
