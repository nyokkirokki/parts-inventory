import { beforeEach, describe, expect, it } from "vitest";
import { createTestClient, type TestClient } from "./harness";

let client: TestClient;
beforeEach(() => { client = createTestClient(); });
const writes = [
  ["POST", "/api/categories"], ["POST", "/api/tags"], ["POST", "/api/locations"],
  ["POST", "/api/statuses"], ["POST", "/api/parts"], ["PUT", "/api/parts/1"],
  ["DELETE", "/api/parts/1"], ["POST", "/api/parts/1/stock"],
  ["POST", "/api/parts/bulk/archive"], ["POST", "/api/parts/bulk/update"],
  ["POST", "/api/import/parts"], ["POST", "/api/import/batches/1/revert"],
  ["POST", "/api/projects"], ["DELETE", "/api/projects/1"],
] as const;
describe("CSRF and request smuggling regression matrix", () => {
  it.each(writes)("rejects cross-origin %s %s", async (method, path) => {
    const result = await client.raw(path, {
      method,
      headers: { origin: "https://evil.example" },
      ...(method === "DELETE" ? {} : { body: "{}" }),
    });
    expect(result.status).toBe(403);
  });
  it.each(["cross-site", "same-site"])("rejects Sec-Fetch-Site %s for mutations", async site => {
    const result = await client.raw("/api/categories", {
      method: "POST",
      headers: { "sec-fetch-site": site },
      body: JSON.stringify({ name: "Evil" }),
    });
    expect(result.status).toBe(403);
  });
  it.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"])(
    "rejects non-JSON mutation body %s", async contentType => {
      const result = await client.raw("/api/categories", {
        method: "POST",
        headers: { "content-type": contentType },
        body: JSON.stringify({ name: "Injected" }),
      });
      expect(result.status).toBe(415);
    },
  );
  it("permits same-origin JSON mutations", async () => {
    const { response, body } = await client.request("/api/categories", {
      method: "POST",
      headers: { origin: "http://localhost", "sec-fetch-site": "same-origin" },
      body: JSON.stringify({ name: "Allowed" }),
    });
    expect(response.status).toBe(201);
    expect(body.data.name).toBe("Allowed");
  });
  it("permits server-to-server requests with no browser origin", async () => {
    const response = await client.raw("/api/categories", {
      method: "POST", body: JSON.stringify({ name: "CLI" }),
    });
    expect(response.status).toBe(201);
  });
  it("does not block authenticated read endpoints by Origin", async () => {
    const response = await client.raw("/api/health", { headers: { origin: "https://evil.example" } });
    expect(response.status).toBe(200);
  });

  it.each([
    "null", "https://localhost", "http://localhost:9090",
    "http://127.0.0.1", "http://localhost.evil.example",
    "ftp://localhost", "not-a-url",
  ])("rejects malformed or non-exact Origin %s", async origin => {
    const response = await client.raw("/api/categories", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify({ name: "Rejected" }),
    });
    expect(response.status).toBe(403);
  });
  it.each(["application/json", "application/json; charset=UTF-8"])(
    "accepts JSON content type %s for same-origin clients", async contentType => {
      const response = await client.raw("/api/categories", {
        method: "POST",
        headers: { "content-type": contentType, origin: "http://localhost" },
        body: JSON.stringify({ name: "Trusted" }),
      });
      expect(response.status).toBe(201);
    },
  );
  it("blocks cross-site write even if Origin looks same-origin", async () => {
    const response = await client.raw("/api/categories", {
      method: "POST",
      headers: { origin: "http://localhost", "sec-fetch-site": "cross-site" },
      body: JSON.stringify({ name: "NotTrusted" }),
    });
    expect(response.status).toBe(403);
  });
});
