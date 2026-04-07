"use client";

import { useState, useMemo } from "react";
import { useAccounts, useInsights } from "@/hooks/useFacebookData";
import { useAppContext } from "@/contexts/AppContext";
import { aggregateMetrics, emptyMetrics, formatMetric } from "@/lib/metrics";
import { ProcessedMetrics, METRIC_DEFINITIONS } from "@/types/metrics";
import { Calendar, ArrowLeftRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function ComparativoPage() {
  const { selectedAccountId, setSelectedAccountId } = useAppContext();

  const { data: accountsData } = useAccounts();
  const accounts = (accountsData?.data || []).filter(
    (a) => Number(a.amount_spent) > 0 && !a.name.includes("Read-Only") && !a.name.includes("Test ")
  );
  const activeAccount = selectedAccountId || accounts[0]?.id || "";

  // Periodo A
  const [sinceA, setSinceA] = useState("");
  const [untilA, setUntilA] = useState("");

  // Periodo B
  const [sinceB, setSinceB] = useState("");
  const [untilB, setUntilB] = useState("");

  const queryA = sinceA && untilA ? `preset=custom&since=${sinceA}&until=${untilA}` : "";
  const queryB = sinceB && untilB ? `preset=custom&since=${sinceB}&until=${untilB}` : "";

  const { data: dataA, loading: loadingA } = useInsights(
    queryA ? activeAccount : null, queryA, undefined, "1"
  );
  const { data: dataB, loading: loadingB } = useInsights(
    queryB ? activeAccount : null, queryB, undefined, "1"
  );

  const metricsA: ProcessedMetrics = useMemo(() => {
    if (!dataA?.data?.length) return emptyMetrics();
    return aggregateMetrics(dataA.data as ProcessedMetrics[]);
  }, [dataA]);

  const metricsB: ProcessedMetrics = useMemo(() => {
    if (!dataB?.data?.length) return emptyMetrics();
    return aggregateMetrics(dataB.data as ProcessedMetrics[]);
  }, [dataB]);

  const COMPARE_METRICS: Array<{ key: keyof ProcessedMetrics; label: string; format: "currency" | "number" | "percent" | "decimal"; lowerBetter: boolean }> = [
    { key: "spend", label: "Gasto", format: "currency", lowerBetter: true },
    { key: "impressions", label: "Impressoes", format: "number", lowerBetter: false },
    { key: "reach", label: "Alcance", format: "number", lowerBetter: false },
    { key: "clicks", label: "Cliques", format: "number", lowerBetter: false },
    { key: "ctr", label: "CTR", format: "percent", lowerBetter: false },
    { key: "cpc", label: "CPC", format: "currency", lowerBetter: true },
    { key: "cpm", label: "CPM", format: "currency", lowerBetter: true },
    { key: "purchases", label: "Vendas", format: "number", lowerBetter: false },
    { key: "costPerSale", label: "Custo/Venda", format: "currency", lowerBetter: true },
    { key: "roas", label: "ROAS", format: "decimal", lowerBetter: false },
    { key: "purchaseValue", label: "Valor Vendas", format: "currency", lowerBetter: false },
  ];

  const formatLabel = (since: string, until: string) => {
    if (!since || !until) return "—";
    return `${new Date(since).toLocaleDateString("pt-BR")} a ${new Date(until).toLocaleDateString("pt-BR")}`;
  };

  const bothSelected = sinceA && untilA && sinceB && untilB;

  return (
    <div>
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <ArrowLeftRight size={20} className="text-accent" />
              Comparativo de Periodos
            </h2>
          </div>
          <select
            value={activeAccount}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent max-w-[280px]"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Seletores de periodo */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Periodo A */}
          <div className="bg-bg-surface border border-accent/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-accent" />
              <span className="text-sm font-medium text-accent">Periodo A</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[10px] text-text-muted mb-1">De</label>
                <input
                  type="date"
                  value={sinceA}
                  onChange={(e) => setSinceA(e.target.value)}
                  className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary [color-scheme:dark]"
                />
              </div>
              <span className="text-text-muted mt-4">—</span>
              <div>
                <label className="block text-[10px] text-text-muted mb-1">Ate</label>
                <input
                  type="date"
                  value={untilA}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setUntilA(e.target.value)}
                  className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary [color-scheme:dark]"
                />
              </div>
            </div>
            {sinceA && untilA && (
              <p className="text-xs text-text-muted mt-2">{formatLabel(sinceA, untilA)}</p>
            )}
          </div>

          {/* Botao inverter */}
          <button
            onClick={() => {
              const tmpSA = sinceA, tmpUA = untilA;
              setSinceA(sinceB); setUntilA(untilB);
              setSinceB(tmpSA); setUntilB(tmpUA);
            }}
            className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-bg-surface border border-border hover:border-accent hover:text-accent text-text-muted transition-colors"
            title="Inverter periodos"
          >
            <ArrowLeftRight size={16} />
          </button>

          {/* Periodo B */}
          <div className="bg-bg-surface border border-purple/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-purple" />
              <span className="text-sm font-medium text-purple">Periodo B</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[10px] text-text-muted mb-1">De</label>
                <input
                  type="date"
                  value={sinceB}
                  onChange={(e) => setSinceB(e.target.value)}
                  className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary [color-scheme:dark]"
                />
              </div>
              <span className="text-text-muted mt-4">—</span>
              <div>
                <label className="block text-[10px] text-text-muted mb-1">Ate</label>
                <input
                  type="date"
                  value={untilB}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setUntilB(e.target.value)}
                  className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary [color-scheme:dark]"
                />
              </div>
            </div>
            {sinceB && untilB && (
              <p className="text-xs text-text-muted mt-2">{formatLabel(sinceB, untilB)}</p>
            )}
          </div>
        </div>

        {/* Tabela comparativa */}
        {bothSelected && (
          <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
            {(loadingA || loadingB) && (
              <div className="px-4 py-3 text-sm text-text-muted">Carregando dados...</div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase">Metrica</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase text-accent">
                    Periodo A
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase text-purple">
                    Periodo B
                  </th>
                  <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase">
                    Variacao
                  </th>
                  <th className="text-center px-4 py-3 text-xs text-text-muted font-medium uppercase w-16">
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_METRICS.map((m) => {
                  const valA = metricsA[m.key] as number;
                  const valB = metricsB[m.key] as number;
                  const change = valA > 0 ? ((valB - valA) / valA) * 100 : 0;
                  const isPositive = m.lowerBetter ? change < 0 : change > 0;
                  const isNeutral = Math.abs(change) < 0.5;

                  return (
                    <tr key={m.key} className="border-b border-border/50 hover:bg-bg-hover">
                      <td className="px-4 py-3 text-text-primary font-medium">{m.label}</td>
                      <td className="text-right px-4 py-3 text-accent tabular-nums font-bold">
                        {formatMetric(valA, m.format)}
                      </td>
                      <td className="text-right px-4 py-3 text-purple tabular-nums font-bold">
                        {formatMetric(valB, m.format)}
                      </td>
                      <td className={`text-right px-4 py-3 tabular-nums font-bold ${
                        isNeutral ? "text-text-muted" : isPositive ? "text-green" : "text-red"
                      }`}>
                        {valA > 0 ? `${change > 0 ? "+" : ""}${change.toFixed(1)}%` : "—"}
                      </td>
                      <td className="text-center px-4 py-3">
                        {isNeutral ? (
                          <Minus size={14} className="text-text-muted mx-auto" />
                        ) : isPositive ? (
                          <TrendingUp size={14} className="text-green mx-auto" />
                        ) : (
                          <TrendingDown size={14} className="text-red mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!bothSelected && (
          <div className="text-center py-12 text-text-muted">
            <ArrowLeftRight size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione dois periodos para comparar</p>
            <p className="text-xs mt-1">Ex: ultima semana vs primeira semana do ano</p>
          </div>
        )}
      </div>
    </div>
  );
}
