import type { ExportRow } from "./export-row-builder";
import { jsPDF } from "jspdf";

export class PdfExporter {
  export(rowsByCategory: Record<string, ExportRow[]>): Response {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const entries = Object.entries(rowsByCategory);

    if (entries.length === 0) {
      doc.text("No parts", 40, 48);
    }

    entries.forEach(([category, rows], categoryIndex) => {
      if (categoryIndex > 0) doc.addPage("a4", "landscape");
      this.drawCategory(doc, category, rows);
    });

    const body = doc.output("arraybuffer");

    return new Response(body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="parts-export.pdf"',
      },
    });
  }

  private drawCategory(doc: jsPDF, category: string, rows: ExportRow[]): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 36;
    const top = 44;
    const rowHeight = 18;
    const columns = ["カテゴリ", "型番", "在庫数", "価格", "保管場所", "タグ", "主要特性"];
    const widths = [84, 120, 48, 58, 112, 106, pageWidth - 36 * 2 - 528];

    doc.setFontSize(14);
    doc.text(this.asciiFallback(category), left, top);
    doc.setFontSize(8);

    let y = top + 24;
    this.drawRow(doc, columns, widths, left, y, true);
    y += rowHeight;

    for (const row of rows) {
      if (y > pageHeight - 40) {
        doc.addPage("a4", "landscape");
        y = top;
        this.drawRow(doc, columns, widths, left, y, true);
        y += rowHeight;
      }

      const primaryAttributes = Object.entries(row)
        .filter(([key]) => !columns.includes(key))
        .map(([key, value]) => `${key}: ${value ?? ""}`)
        .filter((value) => !value.endsWith(": "))
        .slice(0, 6)
        .join(" / ");

      this.drawRow(
        doc,
        [
          row["カテゴリ"],
          row["型番"],
          row["在庫数"],
          row["価格"],
          row["保管場所"],
          row["タグ"],
          row["主要特性"] ?? primaryAttributes,
        ],
        widths,
        left,
        y,
        false,
      );
      y += rowHeight;
    }
  }

  private drawRow(doc: jsPDF, values: unknown[], widths: number[], x: number, y: number, isHeader: boolean): void {
    let cursor = x;
    doc.setFillColor(isHeader ? 240 : 255, isHeader ? 244 : 255, isHeader ? 248 : 255);
    doc.setDrawColor(203, 213, 225);

    values.forEach((value, index) => {
      const width = widths[index];
      doc.rect(cursor, y - 11, width, 18, isHeader ? "FD" : "S");
      doc.text(this.truncate(this.asciiFallback(value), width), cursor + 4, y + 1);
      cursor += width;
    });
  }

  private truncate(value: string, width: number): string {
    const maxLength = Math.max(6, Math.floor(width / 4.8));
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
  }

  private asciiFallback(value: unknown): string {
    const text = String(value ?? "");
    return text.replace(/[^\x20-\x7E]/g, "?");
  }
}
