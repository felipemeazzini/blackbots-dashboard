export interface RawLead {
  source_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  user_id?: string | null;
  signup_at?: string | null;
}

export type Tier = "vip" | "engaged" | "casual" | "cold";

export const ALL_TIERS: Tier[] = ["vip", "engaged", "casual", "cold"];

export interface EnrichedLead extends RawLead {
  score: number;
  tier: Tier;
  months_active: number;
  total_paid_brl: number;
  last_paid_at: string | null;
  currently_active: boolean;
}

export type PresetParamType = "number" | "text";

export interface PresetParam {
  key: string;
  label: string;
  type: PresetParamType;
  required: boolean;
  default?: string | number;
  min?: number;
  max?: number;
}

export interface LeadPreset {
  key: string;
  label: string;
  description: string;
  params: PresetParam[];
}
