"use client";

import { StripeMetrics } from "@/types/stripe";
import { formatMetric } from "@/lib/metrics";
import { CreditCard } from "lucide-react";

interface StripeKpiCardsProps {
  stripeData: StripeMetrics;
  adSpend: number;
}

export default function StripeKpiCards({ stripeData, adSpend }: StripeKpiCardsProps) {
  const realRoas = adSpend > 0 ? stripeData.totalRevenue / adSpend : 0;
  const costPerSale = stripeData.totalSales > 0 ? adSpend / stripeData.totalSales : 0;

  const cards = [
    { label: "VENDAS STRIPE", value: String(stripeData.totalSales), color: "#A855F7" },
    { label: "RECEITA STRIPE", value: formatMetric(stripeData.totalRevenue, "currency"), color: "#A855F7" },
    { label: "ROAS REAL", value: realRoas.toFixed(2), color: realRoas >= 1 ? "#22C55E" : "#EF4444" },
    { label: "CUSTO/VENDA REAL", value: formatMetric(costPerSale, "currency"), color: "#A855F7" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <CreditCard size={14} className="text-purple" />
        <h3 className="text-sm font-medium text-text-secondary">Dados do Stripe (vendas reais)</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-bg-surface border border-purple/20 rounded-xl p-4 hover:border-purple/40 transition-colors"
          >
            <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider block mb-2">
              {card.label}
            </span>
            <span className="text-2xl font-bold" style={{ color: card.color }}>
              {card.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
