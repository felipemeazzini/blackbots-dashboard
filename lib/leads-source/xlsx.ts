import * as XLSX from "xlsx";
import JSZip from "jszip";
import { firstName } from "./normalize";
import { Tier } from "./types";

export const DEFAULT_CHUNK_SIZE = 50;

export interface SavedLead {
  id?: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  tier?: Tier | null;
  score?: number | null;
  signup_at?: string | null;
  appeared_in_lists?: string[];
}

function sortByScore(leads: SavedLead[]): SavedLead[] {
  return [...leads].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function chunkArr<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function joinLists(arr: string[] | undefined): string {
  return (arr || []).join(" | ");
}

export function buildWhatsappXlsxChunks(leads: SavedLead[], chunkSize: number = DEFAULT_CHUNK_SIZE): Buffer[] {
  const sorted = sortByScore(leads).filter((l) => l.phone);
  if (sorted.length === 0) return [];
  const chunks = chunkArr(sorted, chunkSize);
  return chunks.map((slice, i) => {
    const rows = slice.map((l) => ({
      nome: l.name ?? "",
      telefone: l.phone!,
      tier: l.tier ?? "cold",
      data_cadastro: formatDateBR(l.signup_at),
      outras_listas: joinLists(l.appeared_in_lists),
    }));
    return sheetToBuffer(rows, `whatsapp-${i + 1}`);
  });
}

export function buildEmailXlsxChunks(leads: SavedLead[], chunkSize: number = DEFAULT_CHUNK_SIZE): Buffer[] {
  const sorted = sortByScore(leads).filter((l) => l.email);
  if (sorted.length === 0) return [];
  const chunks = chunkArr(sorted, chunkSize);
  return chunks.map((slice, i) => {
    const rows = slice.map((l) => ({
      first_name: firstName(l.name),
      email: l.email!,
      tier: l.tier ?? "cold",
      data_cadastro: formatDateBR(l.signup_at),
      outras_listas: joinLists(l.appeared_in_lists),
    }));
    return sheetToBuffer(rows, `email-${i + 1}`);
  });
}

function sheetToBuffer(rows: Record<string, string>[], sheetName: string): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function bundleXlsxToZip(filesByName: Record<string, Buffer>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, buf] of Object.entries(filesByName)) {
    zip.file(name, buf);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}
