"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Send, Trash2, Eye, Download, Loader2, Crown, Star, Circle, Snowflake, Sparkles, Clock, Plus, X } from "lucide-react";

type Tier = "vip" | "engaged" | "casual" | "cold";
const ALL_TIERS: Tier[] = ["vip", "engaged", "casual", "cold"];

const TIER_META: Record<Tier, { label: string; color: string; bg: string; border: string }> = {
  vip:     { label: "VIP",     color: "text-purple", bg: "bg-purple/10", border: "border-purple/30" },
  engaged: { label: "Engaged", color: "text-green",  bg: "bg-green/10",  border: "border-green/30" },
  casual:  { label: "Casual",  color: "text-yellow", bg: "bg-yellow/10", border: "border-yellow/30" },
  cold:    { label: "Cold",    color: "text-red",    bg: "bg-red/10",    border: "border-red/30" },
};

interface LeadPreset {
  key: string;
  label: string;
  description: string;
  params: { key: string; label: string; type: "number" | "text"; required: boolean; default?: string | number; min?: number; max?: number }[];
}

interface LeadList {
  id: string;
  name: string;
  description: string | null;
  preset_key: string;
  preset_params: Record<string, unknown>;
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

interface LeadTemplate {
  id: string;
  name: string;
  description: string | null;
  preset_key: string;
  preset_params: Record<string, unknown>;
  tier_filter: Tier[];
  schedule_days: number;
  last_run_at: string | null;
  last_list_id: string | null;
  created_by_email: string;
  created_at: string;
  is_overdue: boolean;
  days_since_run: number | null;
}

interface PreviewSample {
  name: string | null;
  email: string | null;
  phone: string | null;
  tier: Tier;
  months_active: number;
  score: number;
  signup_at: string | null;
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

interface PreviewData {
  total: number;
  total_with_email: number;
  total_with_phone: number;
  total_vip: number;
  total_engaged: number;
  total_casual: number;
  total_cold: number;
  sample: PreviewSample[];
}

type Suggestion =
  | { type: "template_overdue"; template_id: string; template_name: string; preset_key: string; days_overdue: number; label: string }
  | { type: "new_signups"; count: number; since_iso: string; label: string; preset_key: "recent_signups"; params: { days: number } }
  | { type: "recent_cancels"; count: number; label: string; preset_key: "canceled_in_period"; params: { days: number } };

function TierIcon({ tier, size = 12 }: { tier: Tier; size?: number }) {
  if (tier === "vip") return <Crown size={size} />;
  if (tier === "engaged") return <Star size={size} />;
  if (tier === "casual") return <Circle size={size} />;
  return <Snowflake size={size} />;
}

type FormMode = "list" | "template";

export default function ListasPage() {
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [presets, setPresets] = useState<LeadPreset[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [templates, setTemplates] = useState<LeadTemplate[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Form state (compartilhado entre modes)
  const [mode, setMode] = useState<FormMode>("list");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [tierFilter, setTierFilter] = useState<Set<Tier>>(new Set(ALL_TIERS));
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [scheduleDays, setScheduleDays] = useState("30");
  const [sinceDate, setSinceDate] = useState("");
  const [untilDate, setUntilDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [runningTplId, setRunningTplId] = useState<string | null>(null);

  useEffect(() => {
    async function loadEmail() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    }
    loadEmail();
  }, []);

  const authHeaders = { "x-user-email": userEmail };

  const loadAll = useCallback(async () => {
    if (!userEmail) return;
    const [presetsRes, listsRes, tplsRes, sugRes] = await Promise.all([
      fetch("/api/admin/leads/presets", { headers: authHeaders }),
      fetch("/api/admin/leads/lists", { headers: authHeaders }),
      fetch("/api/admin/leads/templates", { headers: authHeaders }),
      fetch("/api/admin/leads/suggestions", { headers: authHeaders }),
    ]);
    if (presetsRes.status === 403) {
      setError("Acesso negado. Apenas administradores.");
      return;
    }
    if (presetsRes.ok) setPresets((await presetsRes.json()).data || []);
    if (listsRes.ok) setLists((await listsRes.json()).data || []);
    if (tplsRes.ok) setTemplates((await tplsRes.json()).data || []);
    if (sugRes.ok) setSuggestions((await sugRes.json()).data || []);
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) return;
    loadAll().finally(() => setLoading(false));
  }, [userEmail, loadAll]);

  const currentPreset = presets.find((p) => p.key === selectedPreset);

  const onPresetChange = (key: string) => {
    setSelectedPreset(key);
    setPreview(null);
    const p = presets.find((x) => x.key === key);
    const initial: Record<string, string> = {};
    p?.params.forEach((param) => { initial[param.key] = String(param.default ?? ""); });
    setParamValues(initial);
  };

  const toggleTier = (t: Tier) => {
    const next = new Set(tierFilter);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    if (next.size === 0) return;
    setTierFilter(next);
    setPreview(null);
  };

  const buildParams = () => {
    const params: Record<string, unknown> = {};
    if (!currentPreset) return params;
    for (const p of currentPreset.params) {
      const v = paramValues[p.key];
      params[p.key] = p.type === "number" ? Number(v) : v;
    }
    return params;
  };

  const resetForm = () => {
    setSelectedPreset("");
    setParamValues({});
    setTierFilter(new Set(ALL_TIERS));
    setPreview(null);
    setListName("");
    setListDescription("");
    setScheduleDays("30");
    setSinceDate("");
    setUntilDate("");
  };

  const startPresetWithParams = (presetKey: string, params: Record<string, unknown>) => {
    setMode("list");
    setSelectedPreset(presetKey);
    const p = presets.find((x) => x.key === presetKey);
    const initial: Record<string, string> = {};
    p?.params.forEach((param) => {
      initial[param.key] = String(params[param.key] ?? param.default ?? "");
    });
    setParamValues(initial);
    setTierFilter(new Set(ALL_TIERS));
    setPreview(null);
    // scroll to form
    setTimeout(() => {
      document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const runPreview = async () => {
    if (!currentPreset) return;
    setPreviewing(true);
    setError("");
    setPreview(null);
    try {
      for (const p of currentPreset.params) {
        if (p.required && (paramValues[p.key] === undefined || paramValues[p.key] === "")) {
          setError(`Param "${p.label}" obrigatorio`);
          return;
        }
      }
      const res = await fetch("/api/admin/leads/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ preset_key: currentPreset.key, params: buildParams(), tier_filter: Array.from(tierFilter), since: sinceDate || null, until: untilDate || null }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Erro no preview"); return; }
      setPreview(json.data);
    } finally {
      setPreviewing(false);
    }
  };

  const saveList = async () => {
    if (!currentPreset || !listName.trim()) {
      setError("Nome obrigatorio");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/leads/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: listName.trim(),
          description: listDescription.trim() || undefined,
          preset_key: currentPreset.key,
          params: buildParams(),
          tier_filter: Array.from(tierFilter),
          since: sinceDate || null,
          until: untilDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Erro ao salvar"); return; }
      setMessage(`Lista "${json.data.name}" criada com ${json.data.total_leads} leads`);
      resetForm();
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    if (!currentPreset || !listName.trim()) {
      setError("Nome obrigatorio");
      return;
    }
    const days = Number(scheduleDays);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      setError("Repetir a cada (dias) deve ser entre 1 e 365");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/leads/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: listName.trim(),
          description: listDescription.trim() || undefined,
          preset_key: currentPreset.key,
          params: buildParams(),
          tier_filter: Array.from(tierFilter),
          schedule_days: days,
          since: sinceDate || null,
          until: untilDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Erro ao salvar template"); return; }
      setMessage(`Template "${json.data.name}" salvo. Use "Gerar agora" pra criar a primeira lista.`);
      resetForm();
      setMode("list");
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const runTemplate = async (id: string) => {
    setRunningTplId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/leads/templates/${id}/run`, {
        method: "POST",
        headers: authHeaders,
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Erro ao gerar"); return; }
      setMessage(`Lista "${json.data.name}" gerada com ${json.data.total_leads} leads`);
      await loadAll();
    } finally {
      setRunningTplId(null);
    }
  };

  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Apagar template "${name}"? Listas ja geradas continuam.`)) return;
    const res = await fetch(`/api/admin/leads/templates/${id}`, { method: "DELETE", headers: authHeaders });
    if (res.ok) { setMessage(`Template "${name}" removido`); await loadAll(); }
  };

  const deleteList = async (id: string, name: string) => {
    if (!confirm(`Apagar a lista "${name}"? Os leads sao removidos junto.`)) return;
    const res = await fetch(`/api/admin/leads/lists/${id}`, { method: "DELETE", headers: authHeaders });
    if (res.ok) { setMessage(`Lista "${name}" removida`); await loadAll(); }
  };

  const downloadXlsx = async (id: string, channel: "whatsapp" | "email", name: string) => {
    const res = await fetch(`/api/admin/leads/lists/${id}/export?channel=${channel}`, { headers: authHeaders });
    if (!res.ok) { setError("Erro ao baixar"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}-${channel}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const dismissSuggestion = (key: string) => {
    setDismissed((prev) => new Set(prev).add(key));
  };

  const visibleSuggestions = suggestions.filter((s) => {
    const key = s.type === "template_overdue" ? `tpl:${s.template_id}` : s.type;
    return !dismissed.has(key);
  });

  const handleSuggestionAction = (s: Suggestion) => {
    if (s.type === "template_overdue") {
      runTemplate(s.template_id);
    } else {
      startPresetWithParams(s.preset_key, s.params);
    }
  };

  return (
    <div>
      <header className="sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Send size={20} className="text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">Listas de Leads</h2>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red/10 border border-red/30 rounded-lg px-4 py-3 text-sm text-red">{error}</div>
        )}
        {message && (
          <div className="bg-green/10 border border-green/30 rounded-lg px-4 py-3 text-sm text-green">{message}</div>
        )}

        {loading ? (
          <p className="text-text-muted text-sm">Carregando...</p>
        ) : (
          <>
            {/* Sugestoes */}
            {visibleSuggestions.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-yellow" />
                  <h3 className="text-sm font-semibold text-text-primary">Sugestoes</h3>
                </div>
                <div className="space-y-2">
                  {visibleSuggestions.map((s, i) => {
                    const key = s.type === "template_overdue" ? `tpl:${s.template_id}` : s.type;
                    const isRunning = s.type === "template_overdue" && runningTplId === s.template_id;
                    return (
                      <div key={i} className="bg-bg-surface border border-yellow/30 rounded-lg p-3 flex items-center justify-between gap-3">
                        <p className="text-sm text-text-primary flex-1">{s.label}</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSuggestionAction(s)}
                            disabled={isRunning}
                            className="flex items-center gap-1 px-3 py-1.5 bg-accent/15 text-accent border border-accent/30 rounded-lg text-xs font-medium hover:bg-accent/25 disabled:opacity-50"
                          >
                            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            {s.type === "template_overdue" ? "Gerar agora" : "Criar lista"}
                          </button>
                          <button
                            onClick={() => dismissSuggestion(key)}
                            title="Dispensar"
                            className="p-1.5 text-text-muted hover:text-text-primary"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Templates */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-accent" />
                  <h3 className="text-sm font-semibold text-text-primary">Templates</h3>
                </div>
                <button
                  onClick={() => { setMode("template"); resetForm(); document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" }); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-bg-hover text-text-primary border border-border rounded-lg text-xs font-medium hover:border-accent/30"
                >
                  <Plus size={12} /> Novo template
                </button>
              </div>
              {templates.length === 0 ? (
                <p className="text-text-muted text-xs">Nenhum template ainda. Salve uma config recorrente pra reusar mensalmente.</p>
              ) : (
                <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-hover">
                      <tr className="text-xs text-text-muted uppercase">
                        <th className="text-left px-4 py-2 font-medium">Nome</th>
                        <th className="text-left px-3 py-2 font-medium">Preset</th>
                        <th className="text-right px-3 py-2 font-medium">Repete</th>
                        <th className="text-left px-3 py-2 font-medium">Ultima geracao</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-right px-3 py-2 font-medium">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map((t) => (
                        <tr key={t.id} className="border-t border-border/30">
                          <td className="px-4 py-2 text-text-primary truncate max-w-[200px]">{t.name}</td>
                          <td className="px-3 py-2 text-text-secondary text-xs">{t.preset_key}</td>
                          <td className="px-3 py-2 text-right text-text-secondary tabular-nums text-xs">{t.schedule_days}d</td>
                          <td className="px-3 py-2 text-text-secondary text-xs">
                            {t.last_run_at ? `${new Date(t.last_run_at).toLocaleDateString("pt-BR")} (${t.days_since_run}d)` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {t.is_overdue ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-red/10 text-red font-medium">OVERDUE</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-bg-hover text-text-muted">Em dia</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => runTemplate(t.id)}
                                disabled={runningTplId === t.id}
                                className="flex items-center gap-1 px-3 py-1 bg-accent/15 text-accent rounded text-xs font-medium hover:bg-accent/25 disabled:opacity-50"
                              >
                                {runningTplId === t.id ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                                Gerar agora
                              </button>
                              <button
                                onClick={() => deleteTemplate(t.id, t.name)}
                                title="Apagar"
                                className="p-1 text-text-muted hover:text-red"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Form: criar lista OU template */}
            <section id="form-section" className="bg-bg-surface border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  {mode === "list" ? "Criar nova lista" : "Criar novo template"}
                </h3>
                <button
                  onClick={() => { setMode(mode === "list" ? "template" : "list"); setPreview(null); }}
                  className="text-[11px] text-accent hover:underline"
                >
                  {mode === "list" ? "ou salvar como template →" : "← voltar pra lista unica"}
                </button>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Preset</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => onPresetChange(e.target.value)}
                  className="w-full bg-bg-hover border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
                >
                  <option value="">— Selecione um preset —</option>
                  {presets.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
                {currentPreset && (
                  <p className="text-xs text-text-muted mt-1.5">{currentPreset.description}</p>
                )}
              </div>

              {currentPreset && currentPreset.params.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {currentPreset.params.map((p) => (
                    <div key={p.key}>
                      <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">{p.label}</label>
                      <input
                        type={p.type}
                        value={paramValues[p.key] ?? ""}
                        onChange={(e) => setParamValues({ ...paramValues, [p.key]: e.target.value })}
                        min={p.min}
                        max={p.max}
                        className="w-full bg-bg-hover border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
                      />
                    </div>
                  ))}
                </div>
              )}

              {currentPreset && (
                <div>
                  <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Incluir tiers</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_TIERS.map((t) => {
                      const m = TIER_META[t];
                      const active = tierFilter.has(t);
                      return (
                        <button
                          key={t}
                          onClick={() => toggleTier(t)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? `${m.bg} ${m.color} ${m.border}` : "bg-bg-hover text-text-muted border-border opacity-50"}`}
                        >
                          <TierIcon tier={t} />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-text-muted mt-1">VIP = ativo OU 12+ meses pagos · Engaged = 3-11 meses · Casual = 1-2 meses · Cold = nunca pagou</p>
                </div>
              )}

              {currentPreset && (
                <div>
                  <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Periodo de cadastro (opcional)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={sinceDate}
                      onChange={(e) => { setSinceDate(e.target.value); setPreview(null); }}
                      placeholder="De"
                      className="w-full bg-bg-hover border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
                    />
                    <input
                      type="date"
                      value={untilDate}
                      onChange={(e) => { setUntilDate(e.target.value); setPreview(null); }}
                      placeholder="Ate"
                      className="w-full bg-bg-hover border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted mt-1">Filtra leads pela data de cadastro original. Deixar vazio = sem filtro.</p>
                </div>
              )}

              {currentPreset && mode === "list" && (
                <div className="flex gap-2">
                  <button
                    onClick={runPreview}
                    disabled={previewing}
                    className="flex items-center gap-2 px-4 py-2 bg-bg-hover border border-border rounded-lg text-sm text-text-primary hover:border-accent/30 disabled:opacity-50"
                  >
                    {previewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                    Visualizar
                  </button>
                </div>
              )}

              {/* Preview (so no modo list) */}
              {preview && mode === "list" && (
                <div className="bg-bg-hover border border-border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div><p className="text-[10px] text-text-muted uppercase">Total</p><p className="text-xl font-bold text-text-primary">{preview.total}</p></div>
                    <div><p className="text-[10px] text-text-muted uppercase">Com email</p><p className="text-xl font-bold text-purple">{preview.total_with_email}</p></div>
                    <div><p className="text-[10px] text-text-muted uppercase">Com telefone</p><p className="text-xl font-bold text-green">{preview.total_with_phone}</p></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50">
                    {ALL_TIERS.map((t) => {
                      const m = TIER_META[t];
                      const count = t === "vip" ? preview.total_vip : t === "engaged" ? preview.total_engaged : t === "casual" ? preview.total_casual : preview.total_cold;
                      return (
                        <div key={t} className={`${m.bg} ${m.border} border rounded-lg p-2.5`}>
                          <div className={`flex items-center gap-1.5 ${m.color} text-[10px] uppercase font-semibold mb-0.5`}>
                            <TierIcon tier={t} />{m.label}
                          </div>
                          <p className={`text-lg font-bold ${m.color} tabular-nums`}>{count}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Form fields: nome + descricao + (schedule se template) + botao salvar */}
              {currentPreset && (mode === "template" || (preview && preview.total > 0)) && (
                <div className="pt-3 border-t border-border space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">
                        {mode === "template" ? "Nome do template *" : "Nome da lista *"}
                      </label>
                      <input
                        type="text"
                        value={listName}
                        onChange={(e) => setListName(e.target.value)}
                        placeholder={mode === "template" ? "Ex: Cancelados - mensal" : "Ex: Black Friday — VIP+Engaged"}
                        className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Descricao (opcional)</label>
                      <input
                        type="text"
                        value={listDescription}
                        onChange={(e) => setListDescription(e.target.value)}
                        className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
                      />
                    </div>
                  </div>
                  {mode === "template" && (
                    <div>
                      <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Repetir a cada (dias) — 30 = mensal, 7 = semanal</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={scheduleDays}
                        onChange={(e) => setScheduleDays(e.target.value)}
                        className="w-32 bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
                      />
                    </div>
                  )}
                  <button
                    onClick={mode === "template" ? saveTemplate : saveList}
                    disabled={saving || !listName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-accent/15 text-accent border border-accent/30 rounded-lg text-sm font-medium hover:bg-accent/25 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {mode === "template" ? "Salvar template" : "Salvar lista"}
                  </button>
                  {mode === "template" && (
                    <p className="text-[11px] text-text-muted">Template não gera lista automaticamente. Use o botão "Gerar agora" na tabela acima quando quiser.</p>
                  )}
                </div>
              )}
            </section>

            {/* Listas salvas */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Listas salvas</h3>
              {lists.length === 0 ? (
                <p className="text-text-muted text-sm">Nenhuma lista criada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {lists.map((l) => (
                    <div key={l.id} className="bg-bg-surface border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <Link href={`/admin/listas/${l.id}`} className="text-text-primary font-medium hover:text-accent">{l.name}</Link>
                          {l.description && <p className="text-xs text-text-muted mt-0.5">{l.description}</p>}
                          <p className="text-[11px] text-text-muted mt-1">
                            {l.preset_key} · criada por {l.created_by_email} em {new Date(l.created_at).toLocaleDateString("pt-BR")}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-[10px]">
                            {ALL_TIERS.map((t) => {
                              const m = TIER_META[t];
                              const c = t === "vip" ? l.total_vip : t === "engaged" ? l.total_engaged : t === "casual" ? l.total_casual : l.total_cold;
                              if (!c) return null;
                              return (
                                <span key={t} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${m.bg} ${m.color}`}>
                                  <TierIcon tier={t} size={10} />{m.label} {c}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="text-right"><p className="text-text-primary font-bold tabular-nums">{l.total_leads}</p><p className="text-[10px] text-text-muted">total</p></div>
                          <div className="text-right"><p className="text-purple font-bold tabular-nums">{l.total_with_email}</p><p className="text-[10px] text-text-muted">email</p></div>
                          <div className="text-right"><p className="text-green font-bold tabular-nums">{l.total_with_phone}</p><p className="text-[10px] text-text-muted">whatsapp</p></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                        <Link href={`/admin/listas/${l.id}`} className="flex items-center gap-1 px-3 py-1.5 bg-bg-hover text-text-secondary rounded-lg text-xs font-medium hover:text-text-primary">
                          <Eye size={12} /> Ver
                        </Link>
                        <button onClick={() => downloadXlsx(l.id, "whatsapp", l.name)} disabled={l.total_with_phone === 0} className="flex items-center gap-1 px-3 py-1.5 bg-green/10 text-green rounded-lg text-xs font-medium hover:bg-green/20 disabled:opacity-30">
                          <Download size={12} /> WhatsApp
                        </button>
                        <button onClick={() => downloadXlsx(l.id, "email", l.name)} disabled={l.total_with_email === 0} className="flex items-center gap-1 px-3 py-1.5 bg-purple/10 text-purple rounded-lg text-xs font-medium hover:bg-purple/20 disabled:opacity-30">
                          <Download size={12} /> Email
                        </button>
                        <button onClick={() => deleteList(l.id, l.name)} className="flex items-center gap-1 px-3 py-1.5 bg-bg-hover text-text-muted rounded-lg text-xs hover:text-red ml-auto">
                          <Trash2 size={12} /> Apagar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
