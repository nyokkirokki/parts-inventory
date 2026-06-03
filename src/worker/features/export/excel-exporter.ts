import type { ExportRow } from "./export-row-builder";
import * as XLSX from "xlsx";

export class ExcelExporter {
  export(rowsByCategory: Record<string, ExportRow[]>): Response {
    const workbook = XLSX.utils.book_new();
    const entries: Array<[string, ExportRow[]]> = Object.entries(rowsByCategory);
    const sheets: Array<[string, ExportRow[]]> = entries.length > 0 ? entries : [["Parts", []]];

    for (const [category, rows] of sheets) {
      const headers = Object.keys(rows[0] ?? {});
      const sheetRows = headers.length ? [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))] : [[]];
      const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, this.toSheetName(category));
    }

    const body = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="parts-export.xlsx"',
      },
    });
  }

  private toSheetName(value: string): string {
    const safe = value.replace(/[:\\/?*[\]]/g, "_").trim();
    return (safe || "Parts").slice(0, 31);
  }
}
