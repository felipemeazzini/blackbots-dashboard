"use client";

import { useState } from "react";
import { ProcessedMetrics, MetricKey, METRIC_DEFINITIONS } from "@/types/metrics";
import { formatMetric } from "@/lib/metrics";
import { ROW_COLORS } from "@/lib/goals";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

interface MetricsTableRow {
  id: string;
  name: string;
  status: string;
  metrics: ProcessedMetrics;
  href?: string;
  thumbnailUrl?: string;
  goalStatus?: string | null;
}

interface MetricsTableProps {
  rows: MetricsTableRow[];
  columns?: MetricKey[];
  onRowClick?: (id: string) => void;
}

const DEFAULT_COLUMNS: MetricKey[] = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "purchases",
  "costPerSale",
  "roas",
];

function StatusBadge({ status }: { status: string }) {
  const isActive =
    status === "ACTIVE" || status === "active";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
        isActive
          ? "bg-green/10 text-green"
          : "bg-text-muted/10 text-text-muted"
      }`}
    >
      {status}
    </span>
  );
}

export default function MetricsTable({
  rows,
  columns = DEFAULT_COLUMNS,
  onRowClick,
}: MetricsTableProps) {
  const [sortKey, setSortKey] = useState<MetricKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: MetricKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const aVal = a.metrics[sortKey];
    const bVal = b.metrics[sortKey];
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  return (
    <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">
                Nome
              </th>
              <th className="text-left px-3 py-3 text-xs text-text-muted font-medium uppercase tracking-wider">
                Status
              </th>
              {columns.map((key) => {
                const def = METRIC_DEFINITIONS.find((d) => d.key === key);
                if (!def) return null;
                return (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="text-right px-3 py-3 text-xs text-text-muted font-medium uppercase tracking-wider cursor-pointer hover:text-accent transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1">
                      {def.label}
                      {sortKey === key &&
                        (sortDir === "desc" ? (
                          <ChevronDown size={12} />
                        ) : (
                          <ChevronUp size={12} />
                        ))}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const rowBg = row.goalStatus && row.goalStatus !== "insufficient" && ROW_COLORS[row.goalStatus]
                ? ROW_COLORS[row.goalStatus].bg
                : undefined;
              return (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.id)}
                className={`border-b border-border/50 hover:bg-bg-hover transition-colors ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
                style={rowBg ? { backgroundColor: rowBg } : undefined}
              >
                <td className="px-4 py-3 text-text-primary font-medium">
                  <div className="flex items-center gap-3">
                    {row.thumbnailUrl && (
                      <img
                        src={row.thumbnailUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-bg-hover"
                      />
                    )}
                    <span className="truncate max-w-[250px]" title={row.name}>{row.name}</span>
                    {row.href && (
                      <ExternalLink size={12} className="text-text-muted flex-shrink-0" />
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={row.status} />
                </td>
                {columns.map((key) => {
                  const def = METRIC_DEFINITIONS.find((d) => d.key === key);
                  if (!def) return null;
                  return (
                    <td
                      key={key}
                      className="text-right px-3 py-3 text-text-secondary tabular-nums"
                    >
                      {formatMetric(row.metrics[key], def.format)}
                    </td>
                  );
                })}
              </tr>
            );
            })}
            {sortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="text-center py-8 text-text-muted"
                >
                  Nenhum dado encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
