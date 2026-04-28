import { LeadPreset } from "./types";

export const LEAD_PRESETS: LeadPreset[] = [
  {
    key: "active_subscribers",
    label: "Assinantes ativos",
    description: "Usuarios com pelo menos uma compra ativa (UserPurchase.isActive=true)",
    params: [],
  },
  {
    key: "canceled_subscribers",
    label: "Ex-assinantes (cancelados)",
    description: "Ja compraram alguma vez mas nao tem nenhuma compra ativa hoje",
    params: [],
  },
  {
    key: "recent_signups",
    label: "Cadastros recentes",
    description: "Usuarios cadastrados nos ultimos N dias",
    params: [
      { key: "days", label: "Ultimos N dias", type: "number", required: true, default: 30, min: 1, max: 365 },
    ],
  },
  {
    key: "never_purchased",
    label: "Cadastrados que nunca compraram",
    description: "Usuarios cadastrados que nunca tiveram uma compra associada",
    params: [],
  },
  {
    key: "form_leads",
    label: "Leads de formulario",
    description: "Todos os leads que preencheram formulario na landing page",
    params: [],
  },
  {
    key: "tradeideas_active",
    label: "TradeIdeas — assinantes ativos",
    description: "Usuarios com contrato ativo do TradeIdeas (AutoChartsContract.isActive=true)",
    params: [],
  },
  {
    key: "tradeideas_canceled",
    label: "TradeIdeas — ex-assinantes",
    description: "Ja tiveram TradeIdeas mas nao tem nenhum contrato ativo hoje",
    params: [],
  },
  {
    key: "canceled_in_period",
    label: "Cancelados no periodo",
    description: "Quem teve assinatura/contrato encerrado nos ultimos N dias",
    params: [
      { key: "days", label: "Ultimos N dias", type: "number", required: true, default: 30, min: 1, max: 365 },
    ],
  },
  {
    key: "purchased_in_period",
    label: "Compras no periodo",
    description: "Quem fechou compra nos ultimos N dias (qualquer produto)",
    params: [
      { key: "days", label: "Ultimos N dias", type: "number", required: true, default: 30, min: 1, max: 365 },
    ],
  },
];

export function getPreset(key: string): LeadPreset | undefined {
  return LEAD_PRESETS.find((p) => p.key === key);
}
