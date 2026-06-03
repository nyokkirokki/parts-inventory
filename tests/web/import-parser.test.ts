import { describe, expect, it } from "vitest";
import { parseJsonRows } from "../../src/web/lib/import-parser";

describe("import parser", () => {
  it("parses JSON array rows", () => {
    const rows = parseJsonRows(`[{"category":"抵抗","model_number":"R-001","name":"10k","stock_quantity":"25"}]`);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: "抵抗",
      model_number: "R-001",
      name: "10k",
      stock_quantity: 25,
    });
  });

  it("accepts the raw JSON export envelope and maps its shape", () => {
    const rawExport = JSON.stringify({
      format: "raw",
      parts: [
        {
          categoryName: "抵抗",
          modelNumber: "R-001",
          name: "10kΩ",
          manufacturer: "Yageo",
          footprint: "0603",
          stockQuantity: 25,
          caseNumber: "A-01",
          lowStockThreshold: 3,
          tags: [
            { id: 1, name: "smd" },
            { id: 2, name: "0603" },
          ],
          attributes: [
            { key: "resistance", value: "10", unit: "kΩ", label: "抵抗値" },
            { key: "tolerance", value: "1", unit: "%" },
          ],
        },
      ],
    });

    const rows = parseJsonRows(rawExport);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: "抵抗",
      model_number: "R-001",
      name: "10kΩ",
      manufacturer: "Yageo",
      footprint: "0603",
      stock_quantity: 25,
      case_number: "A-01",
      low_stock_threshold: 3,
      tags: "smd,0603",
    });
    expect(rows[0].attributes_json).toEqual({
      resistance: { value: "10", unit: "kΩ", label: "抵抗値" },
      tolerance: { value: "1", unit: "%" },
    });
  });
});
