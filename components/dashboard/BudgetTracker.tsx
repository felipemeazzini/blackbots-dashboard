"use client";

import { useState } from "react";
import { useBudget } from "@/hooks/useBudget";
import { formatMetric } from "@/lib/metrics";
import { getDaysInMonth, getDate, format } from "date-fns";
import { Wallet, Save, AlertTriangle } from "lucide-react";

interface BudgetTrackerProps {
  accountId: string;
  currentSpend: number;
}

export default function BudgetTracker({ accountId, currentSpend }: BudgetTrackerProps) {
  const { budget, saveBudget } = useBudget(accountId);
  const [editValue, setEditValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editValue) return;
    setSaving(true);
    await saveBudget(Number(editValue));
    setEditValue("");
    setEditing(false);
    setSaving(false);
  };

  if (!budget && !editing) {
    return (
      <div className="bg-bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Wallet size={16} />
          Orcamento mensal nao definido
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-accent hover:text-accent/80 transition-colors"
        >
          Definir orcamento
        </button>
      </div>
    );
  }

  if (editing && !budget) {
    return (
      <div className="bg-bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <Wallet size={16} className="text-accent" />
        <span className="text-sm text-text-secondary">Orcamento {format(new Date(), "MMM yyyy")}:</span>
        <span className="text-xs text-text-muted">R$</span>
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder="10000"
          autoFocus
          className="bg-bg-primary border border-border rounded px-2 py-1 text-sm text-text-primary w-28"
        />
        <button onClick={handleSave} disabled={saving || !editValue}
          className="p-1.5 text-accent hover:text-accent/80 disabled:opacity-30">
          <Save size={14} />
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-text-muted hover:text-text-primary">
          Cancelar
        </button>
      </div>
    );
  }

  const budgetAmount = budget!.budget_amount;
  const percentUsed = budgetAmount > 0 ? (currentSpend / budgetAmount) * 100 : 0;
  const remaining = budgetAmount - currentSpend;

  // Projecao
  const today = new Date();
  const dayOfMonth = getDate(today);
  const daysInMonth = getDaysInMonth(today);
  const dailyAvg = dayOfMonth > 0 ? currentSpend / dayOfMonth : 0;
  const projected = dailyAvg * daysInMonth;
  const overBudget = projected > budgetAmount;

  const barColor =
    percentUsed <= 70 ? "bg-green" : percentUsed <= 90 ? "bg-yellow" : "bg-red";

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-accent" />
          <span className="text-sm font-medium text-text-primary">
            Orcamento {format(today, "MMM yyyy")}
          </span>
        </div>
        <button
          onClick={() => { setEditValue(String(budgetAmount)); setEditing(true); }}
          className="text-[10px] text-text-muted hover:text-text-primary transition-colors"
        >
          Editar
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="w-full h-2.5 bg-bg-hover rounded-full mb-3">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-[10px] text-text-muted uppercase">Orcamento</p>
          <p className="text-sm font-bold text-text-primary">{formatMetric(budgetAmount, "currency")}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase">Gasto</p>
          <p className="text-sm font-bold text-text-primary">{formatMetric(currentSpend, "currency")}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase">Restante</p>
          <p className={`text-sm font-bold ${remaining >= 0 ? "text-green" : "text-red"}`}>
            {formatMetric(Math.abs(remaining), "currency")}
            {remaining < 0 && " acima"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase">Projecao</p>
          <p className={`text-sm font-bold flex items-center justify-center gap-1 ${overBudget ? "text-red" : "text-green"}`}>
            {overBudget && <AlertTriangle size={12} />}
            {formatMetric(projected, "currency")}
          </p>
        </div>
      </div>

      <div className="text-center mt-2">
        <span className="text-[10px] text-text-muted">
          {percentUsed.toFixed(0)}% usado — dia {dayOfMonth}/{daysInMonth}
        </span>
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
          <span className="text-xs text-text-muted">R$</span>
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="bg-bg-primary border border-border rounded px-2 py-1 text-sm text-text-primary w-28"
          />
          <button onClick={handleSave} disabled={saving} className="text-accent text-xs font-medium">
            Salvar
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-text-muted">Cancelar</button>
        </div>
      )}
    </div>
  );
}
