import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export async function exportDashboardPdf(
  element: HTMLElement,
  title: string,
  subtitle: string
) {
  const canvas = await html2canvas(element, {
    backgroundColor: "#1A1A1A",
    scale: 2,
    useCORS: true,
    allowTaint: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // A4 landscape
  const pdf = new jsPDF("l", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Header
  pdf.setFillColor(26, 26, 26);
  pdf.rect(0, 0, pageWidth, 15, "F");
  pdf.setTextColor(245, 166, 35);
  pdf.setFontSize(12);
  pdf.text("BlackBots", 10, 10);
  pdf.setTextColor(200, 200, 200);
  pdf.setFontSize(8);
  pdf.text(`${title} — ${subtitle}`, 50, 10);
  pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageWidth - 60, 10);

  // Content
  const contentTop = 18;
  const availableHeight = pageHeight - contentTop - 5;
  const scaledWidth = pageWidth - 10;
  const scaledHeight = (imgHeight * scaledWidth) / imgWidth;

  if (scaledHeight <= availableHeight) {
    pdf.addImage(imgData, "PNG", 5, contentTop, scaledWidth, scaledHeight);
  } else {
    // Multi-page
    let yOffset = 0;
    const sliceHeight = (availableHeight * imgWidth) / scaledWidth;

    while (yOffset < imgHeight) {
      if (yOffset > 0) pdf.addPage();

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = imgWidth;
      sliceCanvas.height = Math.min(sliceHeight, imgHeight - yOffset);
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(
        canvas,
        0, yOffset, imgWidth, sliceCanvas.height,
        0, 0, imgWidth, sliceCanvas.height
      );

      const sliceData = sliceCanvas.toDataURL("image/png");
      const sliceScaledH = (sliceCanvas.height * scaledWidth) / imgWidth;
      pdf.addImage(sliceData, "PNG", 5, yOffset === 0 ? contentTop : 5, scaledWidth, sliceScaledH);

      yOffset += sliceHeight;
    }
  }

  pdf.save(`${title.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
