type PdfParameter = {
  name: string;
  plain_name: string | null;
  value: string | null;
  unit: string | null;
  reference_range: string | null;
  status: string;
  explanation: string | null;
  suggestion: string | null;
};

type PdfReport = {
  title: string | null;
  original_name: string | null;
  summary: string | null;
  created_at: string;
};

const TONE: Record<string, { label: string; rgb: [number, number, number] }> = {
  red: { label: "Needs attention", rgb: [190, 60, 60] },
  amber: { label: "Slightly off", rgb: [185, 130, 40] },
  green: { label: "In range", rgb: [50, 135, 100] },
};

export async function downloadReportPdf(report: PdfReport, parameters: PdfParameter[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const width = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const text = (
    value: string,
    size: number,
    style: "normal" | "bold" = "normal",
    color: [number, number, number] = [30, 30, 30],
    indent = 0,
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(value, width - indent) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin + indent, y + size);
      y += lineHeight;
    }
  };

  const title = report.title ?? report.original_name ?? "Your report";
  text(title, 20, "bold");
  y += 4;
  text(
    `Added ${new Date(report.created_at).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
    10,
    "normal",
    [120, 120, 120],
  );
  y += 12;

  if (report.summary) {
    text("In a nutshell", 11, "bold", [110, 110, 110]);
    y += 2;
    text(report.summary, 12);
    y += 14;
  }

  const order: Record<string, number> = { red: 0, amber: 1, green: 2 };
  const sorted = [...parameters].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

  for (const p of sorted) {
    const tone = TONE[p.status] ?? TONE.green;
    ensureSpace(60);
    y += 6;
    doc.setDrawColor(225, 225, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    text(p.name, 13, "bold");
    if (p.plain_name) text(p.plain_name, 10, "normal", [120, 120, 120]);
    const valueLine = [
      [p.value, p.unit].filter(Boolean).join(" "),
      p.reference_range ? `Normal: ${p.reference_range}` : null,
      tone.label,
    ]
      .filter(Boolean)
      .join("   •   ");
    text(valueLine, 11, "bold", tone.rgb);
    if (p.explanation) text(p.explanation, 11);
    if (p.suggestion) text(`What can help: ${p.suggestion}`, 11, "normal", [80, 80, 80]);
  }

  y += 20;
  text(
    "This explanation is for education only. It is not a diagnosis and does not replace advice from your doctor.",
    9,
    "normal",
    [130, 130, 130],
  );

  const safe = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "report";
  doc.save(`${safe}.pdf`);
}
