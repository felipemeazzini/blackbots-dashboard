"use client";

import { useState, useMemo } from "react";
import { useAccounts, useCampaigns, useInsights } from "@/hooks/useFacebookData";
import { useAppContext } from "@/contexts/AppContext";
import { useGoals } from "@/hooks/useGoals";
import { aggregateMetrics, emptyMetrics, formatMetric } from "@/lib/metrics";
import { getGoalStatus, ROW_COLORS } from "@/lib/goals";
import { ProcessedMetrics } from "@/types/metrics";
import { GoalStatus } from "@/types/goals";
import DateRangePicker from "@/components/layout/DateRangePicker";
import { KpiSkeleton } from "@/components/ui/Skeleton";
import { Settings2, Save, Trash2, RefreshCw } from "lucide-react";

type InsightRow = ProcessedMetrics & Record<string, unknown>;

export default function MetasPage() {
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

  const { data: campaignsData } = useCampaigns(activeAccount);
  const campaigns = campaignsData?.data || [];

  const { goals, saveGoal, deleteGoal } = useGoals(activeAccount);

  const { data: campInsights, loading: insightsLoading } = useInsights(
    activeAccount, dateQueryString, "campaign", "1", autoRefreshInterval
  );

  // Thresholds
  const [warningPct, setWarningPct] = useState("30");
  const [criticalPct, setCriticalPct] = useState("60");
  const [minPurchases, setMinPurchases] = useState("3");
  const [showSettings, setShowSettings] = useState(false);

  // Inline edit state: { [campaignId]: value }
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleSave = async (campaignId: string) => {
    const val = editValues[campaignId];
    if (!val || !activeAccount) return;
    setSavingId(campaignId);
    await saveGoal({
      campaign_id: campaignId,
      level: "campaign",
      cost_per_purchase_goal: Number(val),
      min_purchases_threshold: Number(minPurchases) || 3,
      warning_threshold_pct: Number(warningPct) / 100,
      critical_threshold_pct: Number(criticalPct) / 100,
    });
    setEditValues((prev) => ({ ...prev, [campaignId]: "" }));
    setSavingId(null);
  };

  // Build table data
  const tableData = useMemo(() => {
    if (!campInsights?.data) return [];
    const insightsList = campInsights.data as InsightRow[];

    const byCampaign = new Map<string, InsightRow[]>();
    for (const row of insightsList) {
      const cid = String(row.campaign_id);
      if (!cid || cid === "undefined") continue;
      if (!byCampaign.has(cid)) byCampaign.set(cid, []);
      byCampaign.get(cid)!.push(row);
    }

    return campaigns
      .map((c) => {
        const dailyRows = byCampaign.get(c.id) || [];
        const metrics = dailyRows.length > 0 ? aggregateMetrics(dailyRows) : emptyMetrics();
        const goal = goals.find((g) => g.campaign_id === c.id);
        const status: GoalStatus = goal
          ? getGoalStatus(metrics.costPerSale, goal, metrics.purchases)
          : null;

        return {
          id: c.id,
          name: c.name,
          campaignStatus: c.effective_status,
          metrics,
          goal,
          goalStatus: status,
        };
      })
      .sort((a, b) => {
        // Active first, then by spend
        if (a.campaignStatus === "ACTIVE" && b.campaignStatus !== "ACTIVE") return -1;
        if (a.campaignStatus !== "ACTIVE" && b.campaignStatus === "ACTIVE") return 1;
        return b.metrics.spend - a.metrics.spend;
      });
  }, [campaigns, campInsights, goals]);

  const isAutoRefreshActive = autoRefreshInterval > 0;

  return (
    <div>
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Metas por Campanha</h2>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={activeAccount}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent max-w-[220px]"
            >
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
            <div className="flex items-center gap-2">
              <RefreshCw
                size={14}
                className={isAutoRefreshActive ? "text-green animate-spin" : "text-text-muted"}
                style={isAutoRefreshActive ? { animationDuration: "3s" } : undefined}
              />
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary"
              >
                <option value={0}>Desligado</option>
                <option value={300000}>5 min</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {/* Config thresholds */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            <Settings2 size={14} />
            Configurar thresholds
          </button>
          {showSettings && (
            <div className="flex items-center gap-3 bg-bg-surface border border-border rounded-lg px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px]" style={{ color: "#eab308" }}>Atencao:</span>
                <input type="number" value={warningPct} onChange={(e) => setWarningPct(e.target.value)}
                  className="bg-bg-primary border border-border rounded px-2 py-0.5 text-xs text-text-primary w-12 text-center" />
                <span className="text-[10px] text-text-muted">%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px]" style={{ color: "#ef4444" }}>Critico:</span>
                <input type="number" value={criticalPct} onChange={(e) => setCriticalPct(e.target.value)}
                  className="bg-bg-primary border border-border rounded px-2 py-0.5 text-xs text-text-primary w-12 text-center" />
                <span className="text-[10px] text-text-muted">%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-text-muted">Min vendas:</span>
                <input type="number" value={minPurchases} onChange={(e) => setMinPurchases(e.target.value)}
                  className="bg-bg-primary border border-border rounded px-2 py-0.5 text-xs text-text-primary w-12 text-center" />
              </div>
            </div>
          )}
        </div>

        {/* Tabela */}
        {insightsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
          </div>
        ) : (
          <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase">Campanha</th>
                    <th className="text-center px-3 py-3 text-xs text-text-muted font-medium uppercase">Status</th>
                    <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase">Gasto</th>
                    <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase">Vendas</th>
                    <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase">Custo/Venda</th>
                    <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase">Meta C/V</th>
                    <th className="text-center px-3 py-3 text-xs text-text-muted font-medium uppercase">Definir Meta</th>
                    <th className="text-center px-3 py-3 text-xs text-text-muted font-medium uppercase w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((c) => {
                    const rowBg = c.goalStatus && c.goalStatus !== "insufficient" && ROW_COLORS[c.goalStatus]
                      ? ROW_COLORS[c.goalStatus].bg
                      : undefined;
                    const costColor = c.goalStatus && c.goalStatus !== "insufficient" && ROW_COLORS[c.goalStatus]
                      ? ROW_COLORS[c.goalStatus].text
                      : undefined;
                    const isActive = c.campaignStatus === "ACTIVE";
                    const editVal = editValues[c.id] ?? (c.goal?.cost_per_purchase_goal?.toString() || "");

                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border/50 transition-colors"
                        style={{ backgroundColor: rowBg }}
                      >
                        <td className="px-4 py-3 text-text-primary font-medium">
                          <span className="truncate max-w-[250px] block" title={c.name}>{c.name}</span>
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            isActive ? "bg-green/10 text-green" : "bg-text-muted/10 text-text-muted"
                          }`}>
                            {isActive ? "ACTIVE" : c.campaignStatus}
                          </span>
                        </td>
                        <td className="text-right px-3 py-3 text-text-secondary tabular-nums">
                          {formatMetric(c.metrics.spend, "currency")}
                        </td>
                        <td className="text-right px-3 py-3 text-text-secondary tabular-nums">
                          {c.metrics.purchases}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums font-bold"
                          style={{ color: costColor || "#F5F5F5" }}
                        >
                          {c.metrics.purchases > 0
                            ? formatMetric(c.metrics.costPerSale, "currency")
                            : "—"}
                          {c.goalStatus === "insufficient" && (
                            <span className="block text-[9px] text-text-muted font-normal">
                              Dados insuficientes
                            </span>
                          )}
                        </td>
                        <td className="text-right px-3 py-3 text-text-muted tabular-nums">
                          {c.goal?.cost_per_purchase_goal
                            ? formatMetric(c.goal.cost_per_purchase_goal, "currency")
                            : "—"}
                        </td>
                        <td className="text-center px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] text-text-muted">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={editVal}
                              onChange={(e) =>
                                setEditValues((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              placeholder="0.00"
                              className="bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary w-20 text-right tabular-nums"
                            />
                            <button
                              onClick={() => handleSave(c.id)}
                              disabled={savingId === c.id || !editValues[c.id]}
                              className="p-1 text-accent hover:text-accent/80 disabled:opacity-30 transition-colors"
                              title="Salvar meta"
                            >
                              <Save size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="text-center px-2 py-3">
                          {c.goal && (
                            <button
                              onClick={() => deleteGoal(c.goal!.id)}
                              className="text-red/60 hover:text-red transition-colors"
                              title="Remover meta"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {tableData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-text-muted">
                        Nenhuma campanha com gasto no periodo
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
