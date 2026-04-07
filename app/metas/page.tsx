"use client";

import { useState, useMemo } from "react";
import { useAccounts, useCampaigns, useInsights } from "@/hooks/useFacebookData";
import { useAppContext } from "@/contexts/AppContext";
import { useGoals } from "@/hooks/useGoals";
import { aggregateMetrics, emptyMetrics, formatMetric } from "@/lib/metrics";
import { getGoalStatus } from "@/lib/goals";
import { ProcessedMetrics } from "@/types/metrics";
import { CampaignGoal, GoalStatus } from "@/types/goals";
import DateRangePicker from "@/components/layout/DateRangePicker";
import TrafficLight from "@/components/dashboard/TrafficLight";
import Sparkline from "@/components/charts/Sparkline";
import { KpiSkeleton } from "@/components/ui/Skeleton";
import { Plus, Trash2, Settings2, RefreshCw } from "lucide-react";

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

  const { goals, saveGoal, deleteGoal, loading: goalsLoading } = useGoals(activeAccount);

  // Insights por campanha (diarios)
  const { data: campInsights } = useInsights(activeAccount, dateQueryString, "campaign", "1", autoRefreshInterval);

  // Form state
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [costGoal, setCostGoal] = useState("");
  const [roasGoal, setRoasGoal] = useState("");
  const [minPurchases, setMinPurchases] = useState("3");
  const [warningPct, setWarningPct] = useState("30");
  const [criticalPct, setCriticalPct] = useState("60");
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleSave = async () => {
    if (!selectedCampaign || !activeAccount) return;
    setSaving(true);
    const wPct = Number(warningPct) / 100;
    const cPct = Number(criticalPct) / 100;
    const minP = Number(minPurchases) || 3;

    if (costGoal) {
      await saveGoal({
        campaign_id: selectedCampaign,
        level: "campaign",
        metric: "cost_per_purchase",
        goal_value: Number(costGoal),
        min_purchases_threshold: minP,
        warning_threshold_pct: wPct,
        critical_threshold_pct: cPct,
      });
    }
    if (roasGoal) {
      await saveGoal({
        campaign_id: selectedCampaign,
        level: "campaign",
        metric: "roas",
        goal_value: Number(roasGoal),
        min_purchases_threshold: minP,
        warning_threshold_pct: wPct,
        critical_threshold_pct: cPct,
      });
    }
    setCostGoal("");
    setRoasGoal("");
    setSaving(false);
  };

  // Tabela de campanhas com metricas e goals
  const campaignTableData = useMemo(() => {
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
        const costGoal = goals.find((g) => g.campaign_id === c.id && g.metric === "cost_per_purchase");
        const roasGoalObj = goals.find((g) => g.campaign_id === c.id && g.metric === "roas");

        const costStatus: GoalStatus | null = costGoal
          ? getGoalStatus(metrics.costPerSale, costGoal, metrics.purchases)
          : null;
        const roasStatus: GoalStatus | null = roasGoalObj
          ? getGoalStatus(metrics.roas, roasGoalObj, metrics.purchases)
          : null;

        // Sparkline: ultimos 7 dias de custo/venda
        const last7 = dailyRows
          .sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""))
          .slice(-7)
          .map((d) => ({
            value: d.purchases > 0 ? d.spend / d.purchases : 0,
            status: costGoal
              ? getGoalStatus(d.purchases > 0 ? d.spend / d.purchases : 0, costGoal, d.purchases)
              : ("insufficient" as GoalStatus),
          }));

        return {
          id: c.id,
          name: c.name,
          status: c.effective_status,
          metrics,
          costGoal,
          roasGoal: roasGoalObj,
          costStatus,
          roasStatus,
          sparklineData: last7,
        };
      })
      .filter((c) => c.metrics.spend > 0)
      .sort((a, b) => b.metrics.spend - a.metrics.spend);
  }, [campaigns, campInsights, goals]);

  const isAutoRefreshActive = autoRefreshInterval > 0;

  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Metas por Campanha</h2>
            <p className="text-xs text-text-muted">{accounts.find((a) => a.id === activeAccount)?.name}</p>
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
                <option value={60000}>1 min</option>
                <option value={300000}>5 min</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-yellow">Atencao:</span>
                <input
                  type="number"
                  value={warningPct}
                  onChange={(e) => setWarningPct(e.target.value)}
                  className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary w-14 text-center"
                />
                <span className="text-[10px] text-text-muted">%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-red">Critico:</span>
                <input
                  type="number"
                  value={criticalPct}
                  onChange={(e) => setCriticalPct(e.target.value)}
                  className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary w-14 text-center"
                />
                <span className="text-[10px] text-text-muted">%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-text-muted">Min vendas:</span>
                <input
                  type="number"
                  value={minPurchases}
                  onChange={(e) => setMinPurchases(e.target.value)}
                  className="bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary w-14 text-center"
                />
              </div>
            </div>
          )}
        </div>

        {/* Formulario */}
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4">Definir Meta</h3>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="min-w-[200px]">
              <label className="block text-xs text-text-muted mb-1">Campanha</label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="">-- Selecione --</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Meta Custo/Venda (R$)</label>
              <input
                type="number"
                step="0.01"
                value={costGoal}
                onChange={(e) => setCostGoal(e.target.value)}
                placeholder="150.00"
                className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary w-32"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Meta ROAS</label>
              <input
                type="number"
                step="0.01"
                value={roasGoal}
                onChange={(e) => setRoasGoal(e.target.value)}
                placeholder="2.00"
                className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary w-24"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !selectedCampaign || (!costGoal && !roasGoal)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-[#1A1A1A] rounded-lg text-sm font-bold hover:bg-accent/80 transition-colors disabled:opacity-50"
            >
              <Plus size={14} />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        {/* Tabela de campanhas com semaforo */}
        <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase">Campanha</th>
                  <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase">Gasto</th>
                  <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase">Vendas</th>
                  <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase">C/Venda</th>
                  <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase">Meta C/V</th>
                  <th className="text-center px-3 py-3 text-xs text-text-muted font-medium uppercase">Status C/V</th>
                  <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase">ROAS</th>
                  <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase">Meta ROAS</th>
                  <th className="text-center px-3 py-3 text-xs text-text-muted font-medium uppercase">Status ROAS</th>
                  <th className="text-center px-3 py-3 text-xs text-text-muted font-medium uppercase">7 dias</th>
                  <th className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {campaignTableData.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-bg-hover">
                    <td className="px-4 py-3 text-text-primary font-medium">
                      <span className="truncate max-w-[200px] block" title={c.name}>{c.name}</span>
                    </td>
                    <td className="text-right px-3 py-3 text-text-secondary tabular-nums">
                      {formatMetric(c.metrics.spend, "currency")}
                    </td>
                    <td className="text-right px-3 py-3 text-text-secondary tabular-nums">
                      {c.metrics.purchases}
                    </td>
                    <td className="text-right px-3 py-3 text-text-primary tabular-nums font-medium">
                      {formatMetric(c.metrics.costPerSale, "currency")}
                    </td>
                    <td className="text-right px-3 py-3 text-text-muted tabular-nums">
                      {c.costGoal ? formatMetric(c.costGoal.goal_value, "currency") : "—"}
                    </td>
                    <td className="text-center px-3 py-3">
                      {c.costStatus ? <TrafficLight status={c.costStatus} /> : <span className="text-text-muted text-xs">—</span>}
                    </td>
                    <td className="text-right px-3 py-3 text-text-primary tabular-nums font-medium">
                      {c.metrics.roas.toFixed(2)}
                    </td>
                    <td className="text-right px-3 py-3 text-text-muted tabular-nums">
                      {c.roasGoal ? c.roasGoal.goal_value.toFixed(2) : "—"}
                    </td>
                    <td className="text-center px-3 py-3">
                      {c.roasStatus ? <TrafficLight status={c.roasStatus} /> : <span className="text-text-muted text-xs">—</span>}
                    </td>
                    <td className="text-center px-3 py-3">
                      <Sparkline
                        data={c.sparklineData}
                        goalValue={c.costGoal?.goal_value}
                      />
                    </td>
                    <td className="text-right px-3 py-3">
                      {(c.costGoal || c.roasGoal) && (
                        <button
                          onClick={() => {
                            if (c.costGoal) deleteGoal(c.costGoal.id);
                            if (c.roasGoal) deleteGoal(c.roasGoal.id);
                          }}
                          className="text-red hover:text-red/80 transition-colors"
                          title="Remover metas"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {campaignTableData.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-text-muted">
                      Nenhuma campanha com gasto no periodo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
