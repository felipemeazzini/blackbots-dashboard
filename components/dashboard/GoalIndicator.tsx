"use client";

interface GoalIndicatorProps {
  actual: number;
  target: number;
  comparison: "lte" | "gte";
}

export default function GoalIndicator({
  actual,
  target,
  comparison,
}: GoalIndicatorProps) {
  const isOnTarget =
    comparison === "lte" ? actual <= target : actual >= target;
  const threshold = target * 0.1;
  const isNear =
    comparison === "lte"
      ? actual > target && actual <= target + threshold
      : actual < target && actual >= target - threshold;

  const color = isOnTarget
    ? "bg-green"
    : isNear
    ? "bg-yellow"
    : "bg-red";

  const label = isOnTarget ? "Na meta" : isNear ? "Perto" : "Fora da meta";

  return (
    <div className="flex items-center gap-1.5" title={`Meta: ${target} - ${label}`}>
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] text-text-muted">{label}</span>
    </div>
  );
}
