import { describe, expect, it } from "vitest";

const baseUrl = process.env.API_BASE_URL;
const basicAuthUser = process.env.BASIC_AUTH_USER ?? "inventory";
const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD ?? "inventory-pass";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const describeApi = baseUrl ? describe : describe.skip;

function basicAuthHeader(user = basicAuthUser, password = basicAuthPassword) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

type ApiResult<T> = {
  response: Response;
  body: T;
  contentType: string;
};

async function request<T = any>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers);
  headers.set("authorization", basicAuthHeader());
  if (options.body) headers.set("content-type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as T)
    : ((await response.arrayBuffer()) as unknown as T);

  return { response, body, contentType };
}

describeApi("API integration tests", () => {
  if (!baseUrl) {
    it("skips API integration tests unless API_BASE_URL is configured", () => {
      expect(baseUrl).toBeUndefined();
    });
    return;
  }

  it("rejects unauthenticated and malformed Basic auth requests", async () => {
    const noAuthResponse = await fetch(`${baseUrl}/api/health`);
    expect(noAuthResponse.status).toBe(401);
    expect(noAuthResponse.headers.get("www-authenticate")).toMatch(/Basic realm="electronics-inventory"/);

    const badPassword = await fetch(`${baseUrl}/api/health`, {
      headers: { authorization: basicAuthHeader(basicAuthUser, `${basicAuthPassword}-wrong`) },
    });
    expect(badPassword.status).toBe(401);

    const malformedBase64 = await fetch(`${baseUrl}/api/health`, {
      headers: { authorization: "Basic !!!" },
    });
    expect(malformedBase64.status).toBe(401);

    const missingSeparator = await fetch(`${baseUrl}/api/health`, {
      headers: { authorization: `Basic ${Buffer.from("inventory").toString("base64")}` },
    });
    expect(missingSeparator.status).toBe(401);
  });

  it("turns bad client input into structured validation errors", async () => {
    const malformedJson = await request("/api/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformedJson.response.status).toBe(400);
    expect(malformedJson.body.error.code).toBe("BAD_REQUEST");
    expect(malformedJson.body.error.message).toBe("Malformed JSON body.");

    const validationError = await request("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    expect(validationError.response.status).toBe(400);
    expect(validationError.body.error.code).toBe("VALIDATION_ERROR");
    expect(validationError.body.error.message).toBe("Request validation failed.");
    expect(Array.isArray(validationError.body.error.issues)).toBe(true);
    expect(validationError.body.error).not.toHaveProperty("stack");
  });

  it("performs core CRUD workflow and validates export behavior", async () => {
    const category = await request("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: `RF ${suffix}` }),
    });
    expect(category.response.status).toBe(201);

    const tagA = await request("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: `radio-${suffix}` }),
    });
    const tagB = await request("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: `uart-${suffix}` }),
    });

    const created = await request("/api/parts", {
      method: "POST",
      body: JSON.stringify({
        categoryId: category.body.data.id,
        modelNumber: `RF-${suffix}`,
        name: "2.4GHz Module",
        stockQuantity: 4,
        price: 320,
        caseNumber: "A-01",
        memo: "api integration",
        lowStockThreshold: 5,
        tagIds: [tagA.body.data.id, tagB.body.data.id],
        tagNames: [],
        attributes: [
          { key: "frequency", label: "Frequency", value: "2.4", unit: "GHz" },
          { key: "interface", label: "Interface", value: "UART", unit: "" },
        ],
      }),
    });
    expect(created.response.status).toBe(201);
    expect(created.body.data.stockQuantity).toBe(4);
    expect(created.body.data.movements.length).toBeGreaterThan(0);

    const updated = await request(`/api/parts/${created.body.data.id}`, {
      method: "PUT",
      body: JSON.stringify({
        categoryId: category.body.data.id,
        modelNumber: `RF-${suffix}`,
        name: "2.4GHz Module Updated",
        stockQuantity: 5,
        price: 320,
        caseNumber: "A-01",
        memo: "updated memo",
        lowStockThreshold: 5,
        tagIds: [tagA.body.data.id, tagB.body.data.id],
        tagNames: [],
        attributes: [
          { key: "frequency", label: "Frequency", value: "2.4", unit: "GHz" },
        ],
      }),
    });
    expect(updated.response.status).toBe(200);
    expect(updated.body.data.name).toBe("2.4GHz Module Updated");
    expect(updated.body.data.stockQuantity).toBe(5);

    const archive = await request(`/api/parts/${created.body.data.id}`, {
      method: "DELETE",
    });
    expect(archive.response.status).toBe(200);
    expect(archive.body.data.ok).toBe(true);

    const restore = await request(`/api/parts/${created.body.data.id}/restore`, {
      method: "POST",
    });
    expect(restore.response.status).toBe(200);
    expect(restore.body.data.ok).toBe(true);

    const permanentDelete = await request(`/api/parts/${created.body.data.id}/permanent`, {
      method: "DELETE",
    });
    expect(permanentDelete.response.status).toBe(200);
    expect(permanentDelete.body.data.ok).toBe(true);

    const deletedResponse = await fetch(`${baseUrl}/api/parts/${created.body.data.id}`, {
      headers: { authorization: basicAuthHeader() },
    });
    expect(deletedResponse.status).toBe(404);

    const xlsx = await request(`/api/export/parts?format=excel&categoryId=${category.body.data.id}`, {
      method: "GET",
    });
    expect(xlsx.response.status).toBe(200);
    expect(xlsx.contentType).toMatch(/spreadsheetml\.sheet/);
    expect(xlsx.body.byteLength).toBeGreaterThan(1000);

    const pdf = await request(`/api/export/parts?format=pdf&categoryId=${category.body.data.id}`, {
      method: "GET",
    });
    expect(pdf.response.status).toBe(200);
    expect(pdf.contentType).toMatch(/application\/pdf/);
    expect(pdf.body.byteLength).toBeGreaterThan(500);
  });

  it("manages category attributes and list headers, and filters parts by attributes", async () => {
    // 1. Create a category
    const category = await request("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: `SpecTest ${suffix}` }),
    });
    const categoryId = category.body.data.id;

    // 2. Define attributes for the category
    await request(`/api/categories/${categoryId}/attributes`, {
      method: "PUT",
      body: JSON.stringify([
        { key: "resistance", label: "Resistance", dataType: "number", unit: "Ω", isSearchable: true, sortOrder: 10 },
        { key: "tolerance", label: "Tolerance", dataType: "number", unit: "%", isSearchable: true, sortOrder: 20 },
      ]),
    });

    const attrs = await request(`/api/categories/${categoryId}/attributes`);
    expect(attrs.body.data.length).toBe(2);
    expect(attrs.body.data[0].key).toBe("resistance");

    // 3. Define custom headers for the category
    await request(`/api/categories/${categoryId}/headers`, {
      method: "PUT",
      body: JSON.stringify([
        { fieldKey: "modelNumber", label: "Model #", sortOrder: 10, isVisible: true },
        { attributeDefinitionId: attrs.body.data[0].id, label: "Resistance", sortOrder: 20, isVisible: true },
        { fieldKey: "stockQuantity", label: "Stock", sortOrder: 30, isVisible: true },
      ]),
    });

    const headers = await request(`/api/categories/${categoryId}/headers`);
    expect(headers.body.data.length).toBe(3);
    expect(headers.body.data[1].label).toBe("Resistance");
    expect(headers.body.data[1].attributeDefinition.key).toBe("resistance");

    // 4. Create a part with attribute values
    const part = await request("/api/parts", {
      method: "POST",
      body: JSON.stringify({
        categoryId,
        modelNumber: `R-${suffix}`,
        name: "Test Resistor",
        stockQuantity: 100,
        attributes: [
          { key: "resistance", value: "1000", unit: "Ω" },
          { key: "tolerance", value: "1", unit: "%" },
        ],
      }),
    });
    await request("/api/parts", {
      method: "POST",
      body: JSON.stringify({
        categoryId,
        modelNumber: `R-HIGH-${suffix}`,
        name: "High Value Resistor",
        stockQuantity: 10,
        attributes: [
          { key: "resistance", value: "4700", unit: "Ω" },
          { key: "tolerance", value: "5", unit: "%" },
        ],
      }),
    });

    // 5. Filter parts by attributes
    const searchAttrs = JSON.stringify({ resistance: 1000 });
    const filtered = await request(`/api/parts?categoryId=${categoryId}&attrs=${encodeURIComponent(searchAttrs)}`);
    expect(filtered.body.data.length).toBe(1);
    expect(filtered.body.data[0].modelNumber).toBe(`R-${suffix}`);
    expect(filtered.body.data[0].attributeValues.some((v: any) => v.key === "resistance" && v.valueNumber === 1000)).toBe(true);

    const noMatchAttrs = JSON.stringify({ resistance: 2000 });
    const noMatch = await request(`/api/parts?categoryId=${categoryId}&attrs=${encodeURIComponent(noMatchAttrs)}`);
    expect(noMatch.body.data.length).toBe(0);

    const greaterThanAttrs = JSON.stringify({ resistance: { op: "gt", val: "1000" } });
    const greaterThan = await request(`/api/parts?categoryId=${categoryId}&attrs=${encodeURIComponent(greaterThanAttrs)}`);
    expect(greaterThan.body.data.map((item: any) => item.modelNumber)).toEqual([`R-HIGH-${suffix}`]);

    const lessThanOrEqualAttrs = JSON.stringify({ resistance: { op: "lte", val: "1000" } });
    const lessThanOrEqual = await request(`/api/parts?categoryId=${categoryId}&attrs=${encodeURIComponent(lessThanOrEqualAttrs)}`);
    expect(lessThanOrEqual.body.data.map((item: any) => item.modelNumber)).toEqual([`R-${suffix}`]);
  });
});
