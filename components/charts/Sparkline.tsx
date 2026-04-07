"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  YAxis,
} from "recharts";
import { GoalStatus } from "@/types/goals";
import { STATUS_CONFIG } from "@/lib/goals";

interface SparklineProps {
  data: Array<{ value: number; status: GoalStatus }>;
  goalValue?: number;
  width?: number;
  height?: number;
}

const STATUS_COLORS: Record<GoalStatus, string> = {
  green: "#22C55E",
  yellow: "#F5A623",
  red: "#EF4444",
  pause: "#EF4444",
  insufficient: "#707070",
};

export default function Sparkline({
  data,
  goalValue,
  width = 120,
  height = 40,
}: SparklineProps) {
  if (data.length === 0) return null;

  // Color the line based on dominant status
  const statusCounts = data.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const dominantStatus = (Object.entries(statusCounts).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0] || "insufficient") as GoalStatus;
  const lineColor = STATUS_COLORS[dominantStatus];

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
          />
          {goalValue !== undefined && (
            <ReferenceLine
              y={goalValue}
              stroke="#707070"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
