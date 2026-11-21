import { beforeEach, describe, expect, it } from "vitest";
import { createTestClient, type TestClient } from "./harness";
let client: TestClient;
beforeEach(() => { client = createTestClient(); });

describe("Basic authentication regression corpus", () => {
  const passwords = [
    "", "Bearer token", "Basic", "Basic ", "Basic !!!",
    "Basic aW52ZW50b3J5", "Basic " + Buffer.from(":").toString("base64"),
    "Basic " + Buffer.from("inventory:wrong").toString("base64"),
    "Basic " + Buffer.from("wrong:inventory-pass").toString("base64"),
    "basic " + Buffer.from("inventory:inventory-pass").toString("base64"),
  ];
  it.each(passwords)("rejects bad Authorization %j", async authorization => {
    const response = await client.raw("/api/health", { headers: { authorization } });
    expect(response.status).toBe(401);
  });
  it.each([
    "/api/health", "/api/parts", "/api/categories", "/api/tags",
    "/api/locations", "/api/statuses", "/api/projects",
    "/api/export/parts", "/", "/parts", "/index.html",
  ])("denies unauthenticated access to %s", async path => {
    const response = await client.raw(path, { headers: { authorization: "" } });
    expect(response.status).toBe(401);
  });
});
describe("stock / movement regression matrix", () => {
  async function seeded() {
    const c = await client.request("/api/categories", {
      method: "POST", body: JSON.stringify({ name: "StockSafety" }),
    });
    const p = await client.request("/api/parts", {
      method: "POST",
      body: JSON.stringify({
        categoryId: c.body.data.id, modelNumber: "REG-001",
        name: "Resistor", stockQuantity: 10,
      }),
    });
    expect(p.response.status).toBe(201);
    return p.body.data.id as number;
  }
  it.each([
    ["in", 3, 13, 3], ["out", 3, 7, -3],
    ["use", 3, 7, -3], ["dispose", 3, 7, -3],
    ["set", 3, 3, -7], ["set", 0, 0, -10],
    ["adjustment", -3, 7, -3], ["adjustment", 4, 14, 4],
  ] as const)("stock %s(%s) => %s delta %s", async (type, quantity, after, delta) => {
    const id = await seeded();
    const changed = await client.request("/api/parts/" + id + "/stock", {
      method: "POST", body: JSON.stringify({ type, quantity, reason: "regression" }),
    });
    expect(changed.response.status).toBe(200);
    expect(changed.body.data.stockQuantity).toBe(after);
    const movements = await client.request("/api/parts/" + id + "/movements");
    const latest = movements.body.data[0];
    expect(latest.quantityBefore).toBe(10);
    expect(latest.quantityAfter).toBe(after);
    expect(latest.quantityDelta).toBe(delta);
  });
  it.each([
    ["out", 11], ["use", 11], ["dispose", 11],
    ["adjustment", -11], ["set", -1], ["in", 0], ["out", 0],
  ] as const)("rejects invalid %s(%s) without mutation", async (type, quantity) => {
    const id = await seeded();
    const bad = await client.request("/api/parts/" + id + "/stock", {
      method: "POST", body: JSON.stringify({ type, quantity }),
    });
    expect(bad.response.status).toBe(400);
    const after = await client.request("/api/parts/" + id);
    expect(after.body.data.stockQuantity).toBe(10);
    const history = await client.request("/api/parts/" + id + "/movements");
    expect(history.body.data).toHaveLength(1);
  });
});
