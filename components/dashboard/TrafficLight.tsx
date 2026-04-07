"use client";

import { GoalStatus } from "@/types/goals";
import { STATUS_CONFIG } from "@/lib/goals";
import { Pause } from "lucide-react";

interface TrafficLightProps {
  status: GoalStatus;
  compact?: boolean;
}

export default function TrafficLight({ status, compact = false }: TrafficLightProps) {
  const config = STATUS_CONFIG[status];

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" title={config.label}>
        <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
        {status === "pause" && <Pause size={10} className="text-red" />}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${config.bgColor} ${config.color}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
      {config.label}
      {status === "pause" && <Pause size={10} />}
    </span>
  );
}
