"use client";

import { useState, useMemo } from "react";
import { useAccounts, useCampaigns, useInsights } from "@/hooks/useFacebookData";
import { useAppContext } from "@/contexts/AppContext";
import { useGoals } from "@/hooks/useGoals";
import { METRIC_DEFINITIONS, MetricKey } from "@/types/metrics";
import { aggregateMetrics, emptyMetrics, formatMetric } from "@/lib/metrics";
import { ProcessedMetrics } from "@/types/metrics";
import Header from "@/components/layout/Header";
import GoalProgressCard from "@/components/dashboard/GoalProgressCard";
import { Trash2, Plus, Target } from "lucide-react";

type InsightRow = ProcessedMetrics & Record<string, unknown>;

const GOALABLE_METRICS: MetricKey[] = [
  "cpm",
  "cpc",
  "costPerSale",
  "cac",
  "ctr",
  "roas",
  "purchases",
];

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
  const accounts = accountsData?.data || [];
  const activeAccount = selectedAccountId || accounts[0]?.id || "";

  // Campanhas
  const { data: campaignsData } = useCampaigns(activeAccount);
  const campaigns = campaignsData?.data || [];

  // Campanha selecionada para definir/ver metas
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  // Goals da campanha selecionada
  const { goals, saveGoal, deleteGoal, loading } = useGoals(
    activeAccount,
    selectedCampaign || undefined
  );

  // Insights diarios por campanha para calcular valores atuais
  const { data: campaignInsights } = useInsights(
    activeAccount,
    dateQueryString,
    "campaign",
    "1",
    autoRefreshInterval
  );

  // Metricas atuais da campanha selecionada
  const currentMetrics: ProcessedMetrics = useMemo(() => {
    if (!selectedCampaign || !campaignInsights?.data) return emptyMetrics();
    const rows = (campaignInsights.data as InsightRow[]).filter(
      (r) => String(r.campaign_id) === selectedCampaign
    );
    return rows.length > 0 ? aggregateMetrics(rows) : emptyMetrics();
  }, [selectedCampaign, campaignInsights]);

  // Todas as campanhas com metas e seus valores atuais (para tabela resumo)
  const allCampaignsWithGoals = useMemo(() => {
    if (!campaignInsights?.data) return [];

    const insightsList = campaignInsights.data as InsightRow[];
    const byCampaign = new Map<string, ProcessedMetrics[]>();
    for (const row of insightsList) {
      const cid = String(row.campaign_id);
      if (!cid) continue;
      if (!byCampaign.has(cid)) byCampaign.set(cid, []);
      byCampaign.get(cid)!.push(row);
    }

    return campaigns
      .map((c) => {
        const rows = byCampaign.get(c.id);
        return {
          id: c.id,
          name: c.name,
          status: c.effective_status,
          metrics: rows ? aggregateMetrics(rows) : emptyMetrics(),
        };
      })
      .filter((c) => c.metrics.spend > 0)
      .sort((a, b) => b.metrics.spend - a.metrics.spend);
  }, [campaigns, campaignInsights]);

  // Form state
  const [formMetric, setFormMetric] = useState<MetricKey>("cpm");
  const [formValue, setFormValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formValue || !activeAccount || !selectedCampaign) return;
    setSaving(true);
    const def = METRIC_DEFINITIONS.find((d) => d.key === formMetric);
    await saveGoal({
      metric_key: formMetric,
      target_value: Number(formValue),
      comparison: def?.comparison || "lte",
      campaign_id: selectedCampaign,
    });
    setFormValue("");
    setSaving(false);
  };

  const selectedCampaignName = campaigns.find(
    (c) => c.id === selectedCampaign
  )?.name;

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
        title="Metas por Campanha"
      />

      <div className="p-6 space-y-6">
        {/* Seletor de campanha */}
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <label className="block text-xs text-text-muted font-medium uppercase mb-2">
            Selecione a campanha
          </label>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent w-full max-w-lg"
          >
            <option value="">-- Escolha uma campanha --</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.effective_status})
              </option>
            ))}
          </select>
        </div>

        {selectedCampaign && (
          <>
            {/* Cards de progresso */}
            {goals.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                  <Target size={14} />
                  Progresso — {selectedCampaignName}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {goals.map((goal) => {
                    const def = METRIC_DEFINITIONS.find(
                      (d) => d.key === goal.metric_key
                    );
                    if (!def) return null;
                    return (
                      <GoalProgressCard
                        key={goal.id}
                        definition={def}
                        actual={currentMetrics[goal.metric_key]}
                        goal={goal}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Formulario de nova meta */}
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-medium text-text-primary mb-4">
                Definir Nova Meta — {selectedCampaignName}
              </h3>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Metrica
                  </label>
                  <select
                    value={formMetric}
                    onChange={(e) =>
                      setFormMetric(e.target.value as MetricKey)
                    }
                    className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                  >
                    {GOALABLE_METRICS.map((key) => {
                      const def = METRIC_DEFINITIONS.find(
                        (d) => d.key === key
                      );
                      return (
                        <option key={key} value={key}>
                          {def?.label || key}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Valor Alvo
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="0.00"
                    className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent w-32"
                  />
                </div>
                <div className="pb-0.5">
                  <span className="text-xs text-text-muted">
                    {METRIC_DEFINITIONS.find((d) => d.key === formMetric)
                      ?.comparison === "lte"
                      ? "Menor e melhor"
                      : "Maior e melhor"}
                  </span>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !formValue}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/80 transition-colors disabled:opacity-50"
                >
                  <Plus size={14} />
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>

            {/* Tabela de metas da campanha */}
            {goals.length > 0 && (
              <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase">
                        Metrica
                      </th>
                      <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase">
                        Meta
                      </th>
                      <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase">
                        Atual
                      </th>
                      <th className="text-center px-4 py-3 text-xs text-text-muted font-medium uppercase">
                        Status
                      </th>
                      <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase">
                        Acoes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {goals.map((goal) => {
                      const def = METRIC_DEFINITIONS.find(
                        (d) => d.key === goal.metric_key
                      );
                      if (!def) return null;
                      const actual = currentMetrics[goal.metric_key];
                      const isOnTarget =
                        goal.comparison === "lte"
                          ? actual <= goal.target_value
                          : actual >= goal.target_value;

                      return (
                        <tr
                          key={goal.id}
                          className="border-b border-border/50 hover:bg-bg-hover"
                        >
                          <td className="px-4 py-3 text-text-primary font-medium">
                            {def.label}
                          </td>
                          <td className="text-right px-4 py-3 text-text-secondary tabular-nums">
                            {formatMetric(goal.target_value, def.format)}
                          </td>
                          <td className="text-right px-4 py-3 text-text-primary tabular-nums font-medium">
                            {formatMetric(actual, def.format)}
                          </td>
                          <td className="text-center px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                isOnTarget
                                  ? "bg-green/10 text-green"
                                  : "bg-red/10 text-red"
                              }`}
                            >
                              {isOnTarget ? "Na meta" : "Fora"}
                            </span>
                          </td>
                          <td className="text-right px-4 py-3">
                            <button
                              onClick={() => deleteGoal(goal.id)}
                              className="text-red hover:text-red/80 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Resumo de todas as campanhas */}
        {!selectedCampaign && allCampaignsWithGoals.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Campanhas com gasto no periodo
            </h3>
            <p className="text-xs text-text-muted mb-4">
              Selecione uma campanha acima para definir e acompanhar metas
            </p>
            <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase">
                      Campanha
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase">
                      Gasto
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase">
                      Vendas
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase">
                      Custo/Venda
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase">
                      ROAS
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-text-muted font-medium uppercase">
                      CPM
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allCampaignsWithGoals.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCampaign(c.id)}
                      className="border-b border-border/50 hover:bg-bg-hover cursor-pointer"
                    >
                      <td className="px-4 py-3 text-text-primary font-medium truncate max-w-[300px]">
                        {c.name}
                      </td>
                      <td className="text-right px-4 py-3 text-text-secondary tabular-nums">
                        {formatMetric(c.metrics.spend, "currency")}
                      </td>
                      <td className="text-right px-4 py-3 text-text-secondary tabular-nums">
                        {c.metrics.purchases}
                      </td>
                      <td className="text-right px-4 py-3 text-text-secondary tabular-nums">
                        {formatMetric(c.metrics.costPerSale, "currency")}
                      </td>
                      <td className="text-right px-4 py-3 text-text-secondary tabular-nums">
                        {c.metrics.roas.toFixed(2)}
                      </td>
                      <td className="text-right px-4 py-3 text-text-secondary tabular-nums">
                        {formatMetric(c.metrics.cpm, "currency")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
