import type { PartSummary } from "@shared/types";
import type { CategoryExportSchema } from "./export-schemas";

export type ExportRow = Record<string, string | number | null>;

export class ExportRowBuilder {
  build(part: PartSummary, schema: CategoryExportSchema): ExportRow {
    const attributes = new Map(
      part.attributes.map((attribute) => [
        attribute.key,
        [attribute.value, attribute.unit].filter(Boolean).join(" "),
      ]),
    );

    return Object.fromEntries(
      schema.columns.map((column) => {
        if (column.source === "attribute") return [column.header, attributes.get(column.key) ?? ""];
        if (column.key === "tags") return [column.header, part.tags.map((tag) => tag.name).join(", ")];
        if (column.key === "location") return [column.header, [part.locationName, part.caseNumber].filter(Boolean).join(" / ")];
        if (column.key === "primaryAttributes") {
          return [
            column.header,
            part.attributes
              .slice(0, 6)
              .map((attribute) => `${attribute.label ?? attribute.key}: ${attribute.value}${attribute.unit ?? ""}`)
              .join(" / "),
          ];
        }

        return [column.header, String(part[column.key as keyof PartSummary] ?? "")];
      }),
    );
  }
}
