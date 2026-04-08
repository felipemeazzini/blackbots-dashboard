"use client";

import { useState } from "react";
import { PdfExportData } from "@/lib/export-pdf";
import { FileDown, Loader2 } from "lucide-react";

interface ExportButtonProps {
  data: PdfExportData | null;
}

export default function ExportButton({ data }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const { exportDashboardPdf } = await import("@/lib/export-pdf");
      await exportDashboardPdf(data);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting || !data}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors disabled:opacity-50"
      title="Exportar como PDF"
    >
      {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
      {exporting ? "Gerando..." : "PDF"}
    </button>
  );
}
