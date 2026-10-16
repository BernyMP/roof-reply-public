import { jsPDF } from "jspdf";
import { PublicSansRegular, PublicSansSemiBold, SourceSerifRegular } from "./fonts/embedded";
import { KIT_PROMISE, KIT_SECTIONS, KIT_TITLE, TRACKING_COLUMNS, type KitBlock } from "../rescue-kit";
import { AUDIT_CTA_URL } from "../../packages/brand/src/pricing-copy";

export function kitPlainText(value: string) {
  return value.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[\u2010-\u2015]/g, "-").replace(/\u00a0/g, " ");
}

export function generateRescueKit() {
  const doc = new jsPDF({ unit: "mm", format: "letter", compress: true, putOnlyUsedFonts: true });
  doc.setCreationDate(new Date("2026-10-13T12:00:00Z"));
  doc.setFileId("524F4F465245504C5952455343554531");
  doc.setProperties({ title: KIT_TITLE, subject: KIT_PROMISE, author: "RoofReply" });
  for (const [file, data, face, style] of [
    ["PublicSans-Regular.ttf", PublicSansRegular, "PublicSans", "normal"],
    ["PublicSans-SemiBold.ttf", PublicSansSemiBold, "PublicSans", "bold"],
    ["SourceSerif4-Regular.ttf", SourceSerifRegular, "SourceSerif", "normal"],
  ]) { doc.addFileToVFS(file, data); doc.addFont(file, face, style); }
  const left = 18, width = 179.9, bottom = 257;
  let y = 26;
  function page() { doc.addPage(); y = 26; }
  function ensure(height: number) { if (y + height > bottom) page(); }
  function font(size = 10.5, bold = false, serif = false) {
    doc.setFont(serif ? "SourceSerif" : "PublicSans", bold ? "bold" : "normal");
    doc.setFontSize(size); doc.setTextColor("#162f42");
  }
  function paragraph(text: string, options: { size?: number; bold?: boolean; serif?: boolean; indent?: number; after?: number } = {}) {
    const { size = 10.5, bold = false, serif = false, indent = 0, after = 4 } = options;
    font(size, bold, serif);
    const lines = doc.splitTextToSize(kitPlainText(text), width - indent) as string[];
    const lineHeight = size * 0.352778 * 1.4;
    // Keep short paragraphs and headings with their following content.
    ensure(Math.min(lines.length, 3) * lineHeight + (bold || serif ? 10 : 0));
    for (const line of lines) {
      ensure(lineHeight); font(size, bold, serif);
      doc.text(line, left + indent, y); y += lineHeight;
    }
    y += after;
  }
  function table(headers: readonly string[], rows: readonly (readonly string[])[]) {
    // Wide spreadsheet rows become field/value cards in a portrait worksheet.
    // This preserves every cell without squeezing nine columns into small type.
    if (headers.length > 3) {
      for (const row of rows) table(["Field", "Entry"], headers.map((h, i) => [h, row[i]]));
      return;
    }
    const widths = headers.length === 2 ? [64, width - 64] : headers.map(() => width / headers.length);
    function row(cells: readonly string[], header = false) {
      font(10, header);
      const lines = cells.map((cell, i) => doc.splitTextToSize(kitPlainText(cell), widths[i] - 8) as string[]);
      const h = Math.max(12, Math.max(...lines.map((l) => l.length)) * 4.8 + 8);
      if (h > bottom - 26) throw new Error("Rescue Kit table row exceeds a readable page.");
      ensure(h);
      let x = left;
      lines.forEach((cell, i) => {
        doc.setFillColor(header ? "#e7edef" : i === 0 ? "#f3f4f0" : "#ffffff");
        doc.setDrawColor("#d4dbd9"); doc.rect(x, y - 4, widths[i], h, "FD");
        font(10, header);
        cell.forEach((line, j) => doc.text(line, x + 4, y + 2 + j * 4.8));
        x += widths[i];
      });
      y += h;
    }
    ensure(30); row(headers, true);
    for (const cells of rows) {
      font(10);
      const h = Math.max(12, Math.max(...cells.map((cell, i) => doc.splitTextToSize(kitPlainText(cell), widths[i] - 8).length)) * 4.8 + 8);
      if (y + h > bottom) { page(); row(headers, true); }
      row(cells);
    }
    y += 7;
  }
  function block(b: KitBlock) {
    if (b.type === "heading") paragraph(b.text, { size: 13, bold: true, after: 5 });
    else if (b.type === "paragraph" || b.type === "quote") {
      if (b.text.startsWith("**") && b.text.endsWith("**")) ensure(45);
      const link = b.text.includes(AUDIT_CTA_URL);
      if (link) {
        ensure(18);
        paragraph(b.text, { bold: true });
        doc.link(left, y - 14, width, 12, { url: AUDIT_CTA_URL });
      } else {
        const text = b.text.startsWith("For a spreadsheet, the same headings")
          ? "For a spreadsheet, download the matching CSV from roofreply.com/rescue-kit. Its headings are listed below. Store entries as text where needed; keep source-record references rather than homeowner details in this sheet."
          : b.text;
        paragraph(text, { indent: b.type === "quote" ? 6 : 0 });
      }
    } else if (b.type === "list") b.items.forEach((item, i) => paragraph(`${b.ordered ? `${i + 1}.` : "•"} ${item}`, { indent: 3 }));
    else if (b.type === "table") table(b.headers, b.rows);
    else paragraph(TRACKING_COLUMNS.join(" / "), { size: 9.5 });
  }
  paragraph("ROOFREPLY / OFFICE FIELD GUIDE", { size: 9, bold: true, after: 10 });
  paragraph(KIT_TITLE, { size: 30, serif: true, after: 7 });
  paragraph(KIT_PROMISE, { size: 14, after: 8 });
  for (const section of KIT_SECTIONS) {
    if (section.id !== "introduction" && section.id !== "start") {
      if (y > 110) page();
      else y += 10;
    }
    paragraph(section.title, { size: 21, serif: true, after: 6 });
    section.blocks.forEach(block);
  }
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p); font(8.5);
    doc.setDrawColor("#d4dbd9"); doc.line(left, 264, left + width, 264);
    doc.text("RoofReply / Missed-Call Rescue Kit", left, 270);
    doc.text(`${p} / ${total}`, left + width, 270, { align: "right" });
  }
  return doc;
}
