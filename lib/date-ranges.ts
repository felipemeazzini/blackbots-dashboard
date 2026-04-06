export interface DatePreset {
  key: string;
  label: string;
  fbPreset: string | null;
}

export const DATE_PRESETS: DatePreset[] = [
  { key: "today", label: "Hoje", fbPreset: "today" },
  { key: "yesterday", label: "Ontem", fbPreset: "yesterday" },
  { key: "last_7d", label: "Ultimos 7 dias", fbPreset: "last_7d" },
  { key: "last_14d", label: "Ultimos 14 dias", fbPreset: "last_14d" },
  { key: "last_30d", label: "Ultimos 30 dias", fbPreset: "last_30d" },
  { key: "this_month", label: "Este mes", fbPreset: "this_month" },
  { key: "last_month", label: "Mes passado", fbPreset: "last_month" },
  { key: "last_90d", label: "Ultimos 90 dias", fbPreset: "last_90d" },
  { key: "custom", label: "Personalizado", fbPreset: null },
];

export function getTimeRangeParam(
  preset: string,
  customSince?: string,
  customUntil?: string
): string | { since: string; until: string } {
  if (preset === "custom" && customSince && customUntil) {
    return { since: customSince, until: customUntil };
  }
  return preset;
}
