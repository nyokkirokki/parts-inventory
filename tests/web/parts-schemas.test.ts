import { describe, expect, it } from "vitest";
import { partWriteSchema, stockChangeSchema } from "../../src/worker/features/parts/parts.schemas";

describe("stockChangeSchema (discriminated stock-change union)", () => {
  it("accepts a positive 'in' movement", () => {
    const result = stockChangeSchema.safeParse({ type: "in", quantity: 5, reason: "restock" });
    expect(result.success).toBe(true);
  });

  it("rejects non-positive quantity for in/out/use/dispose", () => {
    for (const type of ["in", "out", "use", "dispose"] as const) {
      expect(stockChangeSchema.safeParse({ type, quantity: 0 }).success).toBe(false);
      expect(stockChangeSchema.safeParse({ type, quantity: -1 }).success).toBe(false);
    }
  });

  it("allows 'set' to zero but rejects a negative set", () => {
    expect(stockChangeSchema.safeParse({ type: "set", quantity: 0 }).success).toBe(true);
    const negative = stockChangeSchema.safeParse({ type: "set", quantity: -2 });
    expect(negative.success).toBe(false);
    if (!negative.success) {
      expect(negative.error.issues[0].message).toBe("Set quantity must be zero or greater.");
    }
  });

  it("allows positive and negative adjustments but rejects a zero adjustment", () => {
    expect(stockChangeSchema.safeParse({ type: "adjustment", quantity: -3 }).success).toBe(true);
    expect(stockChangeSchema.safeParse({ type: "adjustment", quantity: 7 }).success).toBe(true);
    const zero = stockChangeSchema.safeParse({ type: "adjustment", quantity: 0 });
    expect(zero.success).toBe(false);
    if (!zero.success) {
      expect(zero.error.issues[0].message).toBe("Adjustment quantity must not be zero.");
    }
  });

  it("rejects unknown movement types and coerces numeric strings", () => {
    expect(stockChangeSchema.safeParse({ type: "teleport", quantity: 1 }).success).toBe(false);
    const coerced = stockChangeSchema.parse({ type: "in", quantity: "4" });
    expect(coerced.quantity).toBe(4);
  });
});

describe("partWriteSchema", () => {
  it("applies defaults and normalizes a bare URL to https", () => {
    const parsed = partWriteSchema.parse({
      categoryId: "1",
      modelNumber: "R-001",
      name: "Resistor",
      stockQuantity: "10",
      purchaseUrl: "example.com/buy",
    });
    expect(parsed.lowStockThreshold).toBe(0);
    expect(parsed.attributes).toEqual([]);
    expect(parsed.tagIds).toEqual([]);
    expect(parsed.purchaseUrl).toBe("https://example.com/buy");
  });

  it("rejects empty model number and negative stock", () => {
    expect(
      partWriteSchema.safeParse({ categoryId: 1, modelNumber: "", name: "x", stockQuantity: 1 }).success,
    ).toBe(false);
    expect(
      partWriteSchema.safeParse({ categoryId: 1, modelNumber: "R", name: "x", stockQuantity: -1 }).success,
    ).toBe(false);
  });
});
