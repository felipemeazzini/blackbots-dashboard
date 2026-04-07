"use client";

import { useState, useMemo } from "react";
import { useAccounts, useCampaigns, useInsights } from "@/hooks/useFacebookData";
import { useAppContext } from "@/contexts/AppContext";
import { aggregateMetrics, emptyMetrics } from "@/lib/metrics";
import { ProcessedMetrics } from "@/types/metrics";
import Header from "@/components/layout/Header";
import MetricsTable from "@/components/dashboard/MetricsTable";
import { TableSkeleton } from "@/components/ui/Skeleton";

export default function CampanhasPage() {
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
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data: accountsData } = useAccounts();
  const accounts = (accountsData?.data || []).filter(
    (a) => Number(a.amount_spent) > 0 && !a.name.includes("Read-Only") && !a.name.includes("Test ")
  );
  const activeAccount = selectedAccountId || accounts[0]?.id || "";

  const { data: campaignsData, loading: campLoading } = useCampaigns(
    activeAccount,
    statusFilter !== "ALL" ? statusFilter : undefined,
    autoRefreshInterval
  );
  const campaigns = campaignsData?.data || [];

  // Buscar insights diarios por campanha para agregar
  const { data: insightsData, loading: insLoading } = useInsights(
    activeAccount,
    dateQueryString,
    "campaign",
    "1",
    autoRefreshInterval
  );

  const rows = useMemo(() => {
    const insightsList = (insightsData?.data || []) as (ProcessedMetrics & {
      campaign_id?: string;
    })[];

    // Agrupar por campaign_id
    const byCampaign = new Map<string, ProcessedMetrics[]>();
    for (const row of insightsList) {
      const cid = (row as unknown as Record<string, unknown>).campaign_id as string;
      if (!cid) continue;
      if (!byCampaign.has(cid)) byCampaign.set(cid, []);
      byCampaign.get(cid)!.push(row);
    }

    return campaigns.map((c) => {
      const dailyRows = byCampaign.get(c.id);
      return {
        id: c.id,
        name: c.name,
        status: c.effective_status,
        metrics: dailyRows ? aggregateMetrics(dailyRows) : emptyMetrics(),
      };
    });
  }, [campaigns, insightsData]);

  const isLoading = campLoading || insLoading;

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
        title="Campanhas"
      />

      <div className="p-6 space-y-4">
        <div className="flex gap-2">
          {["ALL", "ACTIVE", "PAUSED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                statusFilter === s
                  ? "bg-accent text-white"
                  : "bg-bg-surface text-text-secondary hover:bg-bg-hover"
              }`}
            >
              {s === "ACTIVE" ? "Ativas" : s === "PAUSED" ? "Pausadas" : "Todas"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : (
          <MetricsTable
            rows={rows}
            onRowClick={(id) =>
              (window.location.href = `/campanha/${id}`)
            }
          />
        )}
      </div>
    </div>
  );
}
