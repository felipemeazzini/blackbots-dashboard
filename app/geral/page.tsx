"use client";

import { useMemo } from "react";
import { useAccounts, useInsights } from "@/hooks/useFacebookData";
import { useAppContext } from "@/contexts/AppContext";
import { aggregateMetrics, emptyMetrics, formatMetric } from "@/lib/metrics";
import { ProcessedMetrics } from "@/types/metrics";
import Header from "@/components/layout/Header";
import KpiGrid from "@/components/dashboard/KpiGrid";
import SpendAreaChart from "@/components/charts/AreaChart";
import { KpiSkeleton } from "@/components/ui/Skeleton";
import { Building2 } from "lucide-react";

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

  const { data: accountsData, loading: accountsLoading } = useAccounts();
  const allAccounts = (accountsData?.data || []).filter(
    (a) =>
      Number(a.amount_spent) > 0 &&
      !a.name.includes("Read-Only") &&
      !a.name.includes("Test ")
  );

  // Buscar insights diarios de CADA conta
  const { data: data0 } = useInsights(
    allAccounts[0]?.id || null,
    dateQueryString,
    undefined,
    "1",
    autoRefreshInterval
  );
  const { data: data1 } = useInsights(
    allAccounts[1]?.id || null,
    dateQueryString,
    undefined,
    "1",
    autoRefreshInterval
  );
  const { data: data2 } = useInsights(
    allAccounts[2]?.id || null,
    dateQueryString,
    undefined,
    "1",
    autoRefreshInterval
  );

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

  // KPIs consolidados (todas as contas)
  const totalMetrics: ProcessedMetrics = useMemo(() => {
    const allMetrics = accountMetrics.filter((a) => a.metrics.spend > 0);
    if (allMetrics.length === 0) return emptyMetrics();
    return aggregateMetrics(allMetrics.map((a) => a.metrics));
  }, [accountMetrics]);

  // Grafico consolidado: somar gasto diario de todas as contas
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
        date: new Date(date).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        value: vals.spend,
        value2: vals.purchases,
      }));
  }, [accountMetrics]);

  const isLoading = accountsLoading || (!data0 && allAccounts.length > 0);

  return (
    <div>
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Visao Geral — Todas as Contas
            </h2>
            <p className="text-xs text-text-muted">
              {allAccounts.length} contas consolidadas
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Date picker sem seletor de conta */}
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { key: "last_7d", label: "7d" },
                { key: "last_14d", label: "14d" },
                { key: "last_30d", label: "30d" },
                { key: "this_month", label: "Mes" },
                { key: "last_90d", label: "90d" },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    dateRange.preset === p.key
                      ? "bg-accent text-[#1A1A1A]"
                      : "bg-bg-surface text-text-secondary hover:bg-bg-hover"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {autoRefreshInterval !== undefined && (
              <>
                <div className="w-px h-6 bg-border" />
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
              </>
            )}
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
          <KpiGrid metrics={totalMetrics} goals={[]} />
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
                v.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })
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
                  <h4 className="text-sm font-semibold text-text-primary">
                    {acc.name}
                  </h4>
                  <span className="text-[10px] text-text-muted ml-auto">
                    {acc.currency}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Gasto</p>
                    <p className="text-sm font-bold text-text-primary">
                      {formatMetric(acc.metrics.spend, "currency")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Vendas</p>
                    <p className="text-sm font-bold text-text-primary">
                      {acc.metrics.purchases}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">Custo/Venda</p>
                    <p className="text-sm font-bold text-text-primary">
                      {formatMetric(acc.metrics.costPerSale, "currency")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">CPM</p>
                    <p className="text-sm font-bold text-text-primary">
                      {formatMetric(acc.metrics.cpm, "currency")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">CPC</p>
                    <p className="text-sm font-bold text-text-primary">
                      {formatMetric(acc.metrics.cpc, "currency")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase">ROAS</p>
                    <p className="text-sm font-bold text-text-primary">
                      {acc.metrics.roas.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
