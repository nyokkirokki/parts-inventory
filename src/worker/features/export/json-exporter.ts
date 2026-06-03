import type { PartSummary } from "@shared/types";
import type { ExportRow } from "./export-row-builder";

export class JsonExporter {
  exportFlat(rowsByCategory: Record<string, ExportRow[]>): Response {
    return Response.json({ format: "flat", categories: rowsByCategory });
  }

  exportRaw(parts: PartSummary[]): Response {
    return Response.json({ format: "raw", parts });
  }
}
