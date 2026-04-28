"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { ArrowLeft, Download, Send, Crown, Star, Circle, Snowflake } from "lucide-react";

type Tier = "vip" | "engaged" | "casual" | "cold";
const ALL_TIERS: Tier[] = ["vip", "engaged", "casual", "cold"];

const TIER_META: Record<Tier, { label: string; color: string; bg: string; border: string }> = {
  vip:     { label: "VIP",     color: "text-purple", bg: "bg-purple/10", border: "border-purple/30" },
  engaged: { label: "Engaged", color: "text-green",  bg: "bg-green/10",  border: "border-green/30" },
  casual:  { label: "Casual",  color: "text-yellow", bg: "bg-yellow/10", border: "border-yellow/30" },
  cold:    { label: "Cold",    color: "text-red",    bg: "bg-red/10",    border: "border-red/30" },
};

function TierIcon({ tier, size = 12 }: { tier: Tier; size?: number }) {
  if (tier === "vip") return <Crown size={size} />;
  if (tier === "engaged") return <Star size={size} />;
  if (tier === "casual") return <Circle size={size} />;
  return <Snowflake size={size} />;
}

interface LeadList {
  id: string;
  name: string;
  description: string | null;
  preset_key: string;
  total_leads: number;
  total_with_email: number;
  total_with_phone: number;
  total_vip: number;
  total_engaged: number;
  total_casual: number;
  total_cold: number;
  tier_filter: Tier[];
  created_by_email: string;
  created_at: string;
}

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source_id: string | null;
  created_at: string;
  score: number;
  tier: Tier;
  months_active: number;
  total_paid_brl: number;
  last_paid_at: string | null;
  currently_active: boolean;
}

export default function ListaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [userEmail, setUserEmail] = useState("");
  const [list, setList] = useState<LeadList | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEmail() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    }
    loadEmail();
  }, []);

  const authHeaders = { "x-user-email": userEmail };

  const loadList = useCallback(async () => {
    if (!userEmail) return;
    const res = await fetch(`/api/admin/leads/lists/${id}?page=${page}&page_size=100`, { headers: authHeaders });
    if (res.status === 403) {
      setError("Acesso negado. Apenas administradores.");
      setLoading(false);
      return;
    }
    if (res.status === 404) {
      setError("Lista nao encontrada.");
      setLoading(false);
      return;
    }
    if (res.ok) {
      const json = await res.json();
      setList(json.data.list);
      setLeads(json.data.leads);
    }
    setLoading(false);
  }, [userEmail, id, page]);

  useEffect(() => {
    if (userEmail) loadList();
  }, [userEmail, loadList]);

  const downloadXlsx = async (channel: "whatsapp" | "email") => {
    if (!list) return;
    const res = await fetch(`/api/admin/leads/lists/${id}/export?channel=${channel}`, { headers: authHeaders });
    if (!res.ok) {
      setError("Erro ao baixar planilha");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${list.name}-${channel}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const totalPages = list ? Math.max(1, Math.ceil(list.total_leads / 100)) : 1;

  return (
    <div>
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/listas" className="text-text-muted hover:text-text-primary">
            <ArrowLeft size={18} />
          </Link>
          <Send size={20} className="text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">{list?.name || "Lista"}</h2>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red/10 border border-red/30 rounded-lg px-4 py-3 text-sm text-red">{error}</div>
        )}
        {loading ? (
          <p className="text-text-muted text-sm">Carregando...</p>
        ) : list && (
          <>
            <section className="bg-bg-surface border border-border rounded-xl p-5 space-y-4">
              {list.description && <p className="text-sm text-text-secondary">{list.description}</p>}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Total</p>
                  <p className="text-2xl font-bold text-text-primary">{list.total_leads}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Com email</p>
                  <p className="text-2xl font-bold text-purple">{list.total_with_email}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Com telefone</p>
                  <p className="text-2xl font-bold text-green">{list.total_with_phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/50">
                {ALL_TIERS.map((t) => {
                  const m = TIER_META[t];
                  const c = t === "vip" ? list.total_vip : t === "engaged" ? list.total_engaged : t === "casual" ? list.total_casual : list.total_cold;
                  return (
                    <div key={t} className={`${m.bg} ${m.border} border rounded-lg p-2.5`}>
                      <div className={`flex items-center gap-1.5 ${m.color} text-[10px] uppercase font-semibold mb-0.5`}>
                        <TierIcon tier={t} />{m.label}
                      </div>
                      <p className={`text-xl font-bold ${m.color} tabular-nums`}>{c}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-text-muted">
                {list.preset_key} · criada por {list.created_by_email} em {new Date(list.created_at).toLocaleString("pt-BR")}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadXlsx("whatsapp")}
                  disabled={list.total_with_phone === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green/10 text-green rounded-lg text-sm font-medium hover:bg-green/20 disabled:opacity-30"
                >
                  <Download size={14} /> Baixar WhatsApp ({list.total_with_phone})
                </button>
                <button
                  onClick={() => downloadXlsx("email")}
                  disabled={list.total_with_email === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-purple/10 text-purple rounded-lg text-sm font-medium hover:bg-purple/20 disabled:opacity-30"
                >
                  <Download size={14} /> Baixar Email ({list.total_with_email})
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-text-primary mb-3">Leads (ordenados por score)</h3>
              <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-bg-hover">
                    <tr className="text-xs text-text-muted uppercase">
                      <th className="text-left px-4 py-2 font-medium">Tier</th>
                      <th className="text-left px-4 py-2 font-medium">Nome</th>
                      <th className="text-left px-4 py-2 font-medium">Email</th>
                      <th className="text-left px-4 py-2 font-medium">Telefone</th>
                      <th className="text-right px-4 py-2 font-medium">Meses</th>
                      <th className="text-right px-4 py-2 font-medium">R$ pago</th>
                      <th className="text-right px-4 py-2 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => {
                      const m = TIER_META[l.tier];
                      return (
                        <tr key={l.id} className="border-t border-border/30">
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${m.bg} ${m.color}`}>
                              <TierIcon tier={l.tier} size={10} />{m.label}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-text-primary truncate max-w-[180px]">{l.name || "—"}</td>
                          <td className="px-4 py-2 text-text-secondary truncate max-w-[220px]">{l.email || "—"}</td>
                          <td className="px-4 py-2 text-text-secondary tabular-nums">{l.phone || "—"}</td>
                          <td className="px-4 py-2 text-right text-text-secondary tabular-nums">{l.months_active}</td>
                          <td className="px-4 py-2 text-right text-text-secondary tabular-nums">{l.total_paid_brl > 0 ? `R$ ${Number(l.total_paid_brl).toFixed(2)}` : "—"}</td>
                          <td className="px-4 py-2 text-right text-text-primary font-medium tabular-nums">{l.score}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 text-xs">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 bg-bg-hover rounded-lg disabled:opacity-30"
                  >
                    Anterior
                  </button>
                  <span className="text-text-muted">Pagina {page} de {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 bg-bg-hover rounded-lg disabled:opacity-30"
                  >
                    Proxima
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
