import { describe, expect, it } from "vitest";
import { clearSearchParamValues, toggleSearchParamValue } from "../../src/web/lib/url-filters";

describe("url filters", () => {
  it("adds multiple tagId values without removing other filters", () => {
    const params = new URLSearchParams("q=uart&tagId=1");
    const next = toggleSearchParamValue(params, "tagId", "2");

    expect(next.get("q")).toBe("uart");
    expect(next.getAll("tagId")).toEqual(["1", "2"]);
  });

  it("removes a selected tagId value", () => {
    const params = new URLSearchParams("tagId=1&tagId=2&stockStatus=low_stock");
    const next = toggleSearchParamValue(params, "tagId", "1");

    expect(next.getAll("tagId")).toEqual(["2"]);
    expect(next.get("stockStatus")).toBe("low_stock");
  });

  it("clears tagId values only", () => {
    const params = new URLSearchParams("categoryId=3&tagId=1&tagId=2");
    const next = clearSearchParamValues(params, "tagId");

    expect(next.getAll("tagId")).toEqual([]);
    expect(next.get("categoryId")).toBe("3");
  });
});
