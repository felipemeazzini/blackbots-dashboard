export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

// Brasil: 10 (fixo) ou 11 (movel) digitos sem DDI; 12/13 com DDI 55. Saida E.164.
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return null;
}

export function firstName(name: string | null | undefined): string {
  if (!name) return "";
  return name.trim().split(/\s+/)[0] || "";
}

export function fullName(first: string | null | undefined, last?: string | null): string | null {
  const a = (first || "").trim();
  const b = (last || "").trim();
  const joined = [a, b].filter(Boolean).join(" ");
  return joined.length > 0 ? joined : null;
}
