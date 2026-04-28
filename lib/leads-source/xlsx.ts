import * as XLSX from "xlsx";
import { firstName } from "./normalize";
import { Tier } from "./types";

export interface SavedLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  tier?: Tier | null;
  score?: number | null;
}

function sortByScore(leads: SavedLead[]): SavedLead[] {
  return [...leads].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function buildWhatsappXlsx(leads: SavedLead[]): Buffer {
  const rows = sortByScore(leads)
    .filter((l) => l.phone)
    .map((l) => ({ nome: l.name ?? "", telefone: l.phone!, tier: l.tier ?? "cold" }));
  return sheetToBuffer(rows, "whatsapp");
}

export function buildEmailXlsx(leads: SavedLead[]): Buffer {
  const rows = sortByScore(leads)
    .filter((l) => l.email)
    .map((l) => ({ first_name: firstName(l.name), email: l.email!, tier: l.tier ?? "cold" }));
  return sheetToBuffer(rows, "email");
}

function sheetToBuffer(rows: Record<string, string>[], sheetName: string): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
