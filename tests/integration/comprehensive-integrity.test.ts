import { describe, expect, it } from "vitest";
import { createTestClient } from "./harness";

const sample = { categoryId: 2, modelNumber: "AUDIT-1", name: "監査用部品", stockQuantity: 10 };
async function post(client: ReturnType<typeof createTestClient>, path: string, data: unknown) {
  return client.request(path, { method: "POST", body: JSON.stringify(data) });
}
async function get(client: ReturnType<typeof createTestClient>, path: string) {
  return client.request(path);
}

describe("data integrity and production-limit regressions", () => {
  it("does not leave an orphaned part after duplicate attributes make a create fail", async () => {
    const c = createTestClient();
    const response = await post(c, "/api/parts", {
      ...sample, modelNumber: "AUDIT-DUP",
      attributes: [{ key: "duplicate", value: "one" }, { key: "duplicate", value: "two" }],
    });
    expect(response.response.status).toBeGreaterThanOrEqual(400);
    const items = await get(c, "/api/parts?q=AUDIT-DUP");
    expect(items.body.total).toBe(0);
  });

  it("does not wipe unrelated fields when an import updates a matching part", async () => {
    const c = createTestClient();
    const created = await post(c, "/api/parts", {
      ...sample, modelNumber: "IMPORT-PRESERVE",
      description: "Keep description", locationId: 1, purchaseUrl: "https://example.com/buy",
      datasheetUrl: "https://example.com/spec", statusId: 1,
      alternatives: ["PART-ALTERNATIVE"], price: null,
    });
    expect(created.response.status).toBe(201);
    const imported = await post(c, "/api/import/parts", {
      mode: "update",
      rows: [{ category: "受動部品", model_number: "IMPORT-PRESERVE", name: "更新名", stock_quantity: 14, price: 9 }],
    });
    expect(imported.response.status).toBe(200);
    expect(imported.body.data.updated).toBe(1);
    const after = await get(c, "/api/parts/" + created.body.data.id);
    expect(after.body.data).toMatchObject({
      description: "Keep description", locationId: 1, statusId: 1,
      purchaseUrl: "https://example.com/buy", datasheetUrl: "https://example.com/spec",
      stockQuantity: 14, price: 9,
    });
    expect(after.body.data.alternatives.map((a: { text: string }) => a.text)).toEqual(["PART-ALTERNATIVE"]);
  });

  it("keeps 50-item list hydration inside the 50-query Cloudflare Free budget", async () => {
    const c = createTestClient();
    await c.db.exec(
      Array.from({ length: 50 }, (_, i) =>
        "INSERT INTO parts (category_id, model_number, name, stock_quantity) VALUES (2, 'QCOUNT-" + i + "', 'QCOUNT-" + i + "', 1)",
      ).join(";\n") + ";",
    );
    let calls = 0;
    const original = c.db.prepare.bind(c.db);
    c.db.prepare = (sql: string) => {
      calls++;
      if (calls > 50) throw new Error("Cloudflare Free D1 request exceeded 50 queries");
      return original(sql);
    };
    const result = await get(c, "/api/parts?pageSize=50");
    expect(result.response.status).toBe(200);
    expect(result.body.data).toHaveLength(50);
    expect(calls).toBeLessThanOrEqual(50);
  });

  it("never loses a stock increment when several authenticated writes overlap", async () => {
    const c = createTestClient();
    const created = await post(c, "/api/parts", sample);
    const id = created.body.data.id;
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        post(c, "/api/parts/" + id + "/stock", { type: "in", quantity: 1, reason: "parallel" }),
      ),
    );
    expect(responses.map(x => x.response.status)).toEqual(Array(20).fill(200));
    const final = await get(c, "/api/parts/" + id);
    expect(final.body.data.stockQuantity).toBe(30);
    const history = await get(c, "/api/parts/" + id + "/movements");
    expect(history.body.data).toHaveLength(21);
    const deltas = history.body.data.filter((m: { movementType: string }) => m.movementType === "in");
    expect(deltas.reduce((n: number, m: { quantityDelta: number }) => n + m.quantityDelta, 0)).toBe(20);
  });

  it("rolls back project creation when its dependent inserts fail", async () => {
    const c = createTestClient();
    const original = c.db.batch.bind(c.db);
    c.db.batch = async (...args: Parameters<typeof original>) => {
      throw new Error("injected batch failure");
    };
    const res = await post(c, "/api/projects", { name: "MUST-ROLLBACK", costs: [{ name: "labor", amount: 50 }] });
    expect(res.response.status).toBeGreaterThanOrEqual(400);
    c.db.batch = original;
    const check = await get(c, "/api/projects");
    expect(check.body.data.some((p: { name: string }) => p.name === "MUST-ROLLBACK")).toBe(false);
  });
});
