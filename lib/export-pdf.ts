import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ProcessedMetrics, METRIC_DEFINITIONS } from "@/types/metrics";
import { formatMetric } from "@/lib/metrics";

export interface PdfExportData {
  accountName: string;
  dateRangeLabel: string;
  metrics: ProcessedMetrics;
  previousMetrics?: ProcessedMetrics;
  campaignRows: Array<{
    name: string;
    status: string;
    metrics: ProcessedMetrics;
  }>;
  adRows: Array<{
    name: string;
    metrics: ProcessedMetrics;
  }>;
}

// Colors
const BG_PRIMARY: [number, number, number] = [26, 26, 26];
const BG_SURFACE: [number, number, number] = [36, 36, 36];
const BG_ALT: [number, number, number] = [30, 30, 30];
const BORDER: [number, number, number] = [58, 58, 58];
const TEXT_PRIMARY: [number, number, number] = [245, 245, 245];
const TEXT_SECONDARY: [number, number, number] = [176, 176, 176];
const TEXT_MUTED: [number, number, number] = [112, 112, 112];
const ACCENT: [number, number, number] = [245, 166, 35];
const GREEN: [number, number, number] = [34, 197, 94];
const RED: [number, number, number] = [239, 68, 68];

const KPI_KEYS: Array<keyof ProcessedMetrics> = [
  "spend", "impressions", "reach", "clicks", "ctr", "cpc",
  "cpm", "conversions", "purchases", "costPerSale", "roas", "purchaseValue",
];

function drawPageBackground(pdf: jsPDF) {
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(...BG_PRIMARY);
  pdf.rect(0, 0, w, h, "F");
}

function drawFooter(pdf: jsPDF, pageNum: number) {
  const w = pdf.internal.pageSize.getWidth();
  pdf.setTextColor(...TEXT_MUTED);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.text("BlackBots - Relatorio de Marketing", 10, 205);
  pdf.text(`Pagina ${pageNum}`, w - 10, 205, { align: "right" });
}

function drawHeader(pdf: jsPDF, data: PdfExportData) {
  const w = pdf.internal.pageSize.getWidth();

  // Header bar
  pdf.setFillColor(...BG_SURFACE);
  pdf.rect(0, 0, w, 22, "F");

  // Orange accent line
  pdf.setFillColor(...ACCENT);
  pdf.rect(0, 22, w, 0.8, "F");

  // Brand
  pdf.setTextColor(...ACCENT);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("BlackBots", 10, 14);

  // Subtitle
  pdf.setTextColor(...TEXT_PRIMARY);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text("Relatorio de Marketing", 52, 14);

  // Right side info
  pdf.setTextColor(...TEXT_SECONDARY);
  pdf.setFontSize(9);
  pdf.text(`${data.accountName}  |  ${data.dateRangeLabel}`, w - 10, 10, { align: "right" });
  pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, w - 10, 16, { align: "right" });
}

function drawKpiGrid(pdf: jsPDF, data: PdfExportData, startY: number): number {
  const boxW = 43.5;
  const boxH = 18;
  const gap = 2;
  const startX = 10;

  KPI_KEYS.forEach((key, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const x = startX + col * (boxW + gap);
    const y = startY + row * (boxH + gap);

    const def = METRIC_DEFINITIONS.find((d) => d.key === key);
    if (!def) return;

    const value = data.metrics[key] as number;
    const prevValue = data.previousMetrics?.[key] as number | undefined;

    // Box
    pdf.setFillColor(...BG_SURFACE);
    pdf.roundedRect(x, y, boxW, boxH, 1.5, 1.5, "F");

    // Label
    pdf.setTextColor(...TEXT_MUTED);
    pdf.setFontSize(6.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(def.label.toUpperCase(), x + 3, y + 5);

    // Value
    pdf.setTextColor(...TEXT_PRIMARY);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(formatMetric(value, def.format), x + 3, y + 12.5);

    // Change vs previous
    if (prevValue !== undefined && prevValue > 0) {
      const change = ((value - prevValue) / prevValue) * 100;
      const isPositive = def.comparison === "gte" ? change > 0 : change < 0;
      pdf.setTextColor(...(isPositive ? GREEN : RED));
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "normal");
      const sign = change > 0 ? "+" : "";
      pdf.text(`${sign}${change.toFixed(1)}% vs anterior`, x + 3, y + 16.5);
    }
  });

  return startY + 2 * (boxH + gap) + 4;
}

export async function exportDashboardPdf(data: PdfExportData) {
  const pdf = new jsPDF("l", "mm", "a4");
  let pageNum = 1;

  // Page 1
  drawPageBackground(pdf);
  drawHeader(pdf, data);

  // KPIs
  const afterKpis = drawKpiGrid(pdf, data, 28);

  // Filter campaigns with spend > 0
  const activeCampaigns = data.campaignRows.filter((r) => r.metrics.spend > 0);

  // Campaigns title
  pdf.setTextColor(...TEXT_SECONDARY);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Campanhas com gasto (${activeCampaigns.length})`, 10, afterKpis + 2);

  // Campaigns table
  const campBody = activeCampaigns.map((r) => [
    r.name.length > 45 ? r.name.substring(0, 45) + "..." : r.name,
    r.status === "ACTIVE" ? "Ativo" : "Pausado",
    formatMetric(r.metrics.spend, "currency"),
    formatMetric(r.metrics.impressions, "number"),
    formatMetric(r.metrics.clicks, "number"),
    `${r.metrics.ctr.toFixed(2)}%`,
    formatMetric(r.metrics.cpc, "currency"),
    String(r.metrics.purchases),
    formatMetric(r.metrics.costPerSale, "currency"),
    r.metrics.roas.toFixed(2),
  ]);

  // Totals row
  campBody.push([
    "TOTAL",
    "",
    formatMetric(data.metrics.spend, "currency"),
    formatMetric(data.metrics.impressions, "number"),
    formatMetric(data.metrics.clicks, "number"),
    `${data.metrics.ctr.toFixed(2)}%`,
    formatMetric(data.metrics.cpc, "currency"),
    String(data.metrics.purchases),
    formatMetric(data.metrics.costPerSale, "currency"),
    data.metrics.roas.toFixed(2),
  ]);

  autoTable(pdf, {
    startY: afterKpis + 5,
    margin: { left: 10, right: 10 },
    head: [["Campanha", "Status", "Gasto", "Impressoes", "Cliques", "CTR", "CPC", "Vendas", "C/Venda", "ROAS"]],
    body: campBody,
    theme: "plain",
    styles: {
      fillColor: BG_PRIMARY,
      textColor: TEXT_SECONDARY,
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: BORDER,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: BG_SURFACE,
      textColor: TEXT_MUTED,
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: BG_ALT,
    },
    columnStyles: {
      0: { cellWidth: 65, halign: "left" },
      1: { cellWidth: 16, halign: "center" },
      2: { cellWidth: 24, halign: "right" },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 16, halign: "right" },
      8: { cellWidth: 24, halign: "right" },
      9: { cellWidth: 18, halign: "right" },
    },
    didParseCell: (hookData) => {
      // Bold totals row
      if (hookData.section === "body" && hookData.row.index === campBody.length - 1) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.textColor = ACCENT;
      }
    },
    didDrawPage: () => {
      pageNum++;
      drawPageBackground(pdf);
      drawFooter(pdf, pageNum - 1);
    },
  });

  // Ads that sold
  if (data.adRows.length > 0) {
    const finalY = (pdf as unknown as Record<string, Record<string, number>>).lastAutoTable.finalY;
    let adsY = finalY + 8;

    if (adsY > 180) {
      pdf.addPage();
      drawPageBackground(pdf);
      pageNum++;
      adsY = 15;
    }

    pdf.setTextColor(...TEXT_SECONDARY);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Anuncios que Venderam (${data.adRows.length})`, 10, adsY);

    autoTable(pdf, {
      startY: adsY + 3,
      margin: { left: 10, right: 10 },
      head: [["Anuncio", "Gasto", "Vendas", "Custo/Venda", "ROAS", "CTR", "CPC"]],
      body: data.adRows.map((r) => [
        r.name.length > 50 ? r.name.substring(0, 50) + "..." : r.name,
        formatMetric(r.metrics.spend, "currency"),
        String(r.metrics.purchases),
        formatMetric(r.metrics.costPerSale, "currency"),
        r.metrics.roas.toFixed(2),
        `${r.metrics.ctr.toFixed(2)}%`,
        formatMetric(r.metrics.cpc, "currency"),
      ]),
      theme: "plain",
      styles: {
        fillColor: BG_PRIMARY,
        textColor: TEXT_SECONDARY,
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: BORDER,
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: BG_SURFACE,
        textColor: TEXT_MUTED,
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: BG_ALT,
      },
      columnStyles: {
        0: { cellWidth: 90, halign: "left" },
        1: { cellWidth: 30, halign: "right" },
        2: { cellWidth: 20, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 20, halign: "right" },
        6: { cellWidth: 25, halign: "right" },
      },
      didDrawPage: () => {
        pageNum++;
        drawPageBackground(pdf);
        drawFooter(pdf, pageNum - 1);
      },
    });
  }

  // First page footer
  pdf.setPage(1);
  drawFooter(pdf, 1);

  // Save
  const filename = `BlackBots_${data.accountName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
}
