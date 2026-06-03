import { describe, expect, it } from "vitest";
import { slugify, toSearchText } from "../../src/worker/utils";

describe("slugify", () => {
  it("produces an ASCII slug from latin text", () => {
    expect(slugify("RF Transceiver")).toBe("rf-transceiver");
    expect(slugify("  Multi   Word  ")).toBe("multi-word");
    expect(slugify("Foo_Bar.Baz")).toBe("foo-bar-baz");
  });

  it("strips leading/trailing separators", () => {
    expect(slugify("--Hello--")).toBe("hello");
    expect(slugify("!!!abc!!!")).toBe("abc");
  });

  it("falls back to a deterministic hash slug for non-ASCII input", () => {
    const a = slugify("抵抗");
    const b = slugify("抵抗");
    expect(a).toMatch(/^item-[0-9a-z]+$/);
    expect(a).toBe(b); // deterministic
    expect(slugify("コンデンサ")).not.toBe(a); // different input -> different hash
  });

  it("falls back to a hash slug for empty / whitespace-only input", () => {
    expect(slugify("")).toMatch(/^item-[0-9a-z]+$/);
    expect(slugify("   ")).toMatch(/^item-[0-9a-z]+$/);
  });
});

describe("toSearchText", () => {
  it("lowercases and joins all populated fields with spaces", () => {
    const text = toSearchText({
      modelNumber: "R-001",
      name: "10kΩ Resistor",
      manufacturer: "Yageo",
      categoryName: "抵抗",
    });
    expect(text).toBe("r-001 10kω resistor yageo 抵抗");
  });

  it("omits null/undefined/empty fields", () => {
    const text = toSearchText({
      modelNumber: "R-001",
      name: "Resistor",
      description: null,
      manufacturer: undefined,
      footprint: "",
    });
    expect(text).toBe("r-001 resistor");
  });

  it("includes tag names and flattened attribute fields", () => {
    const text = toSearchText({
      modelNumber: "R-001",
      name: "Resistor",
      tagNames: ["smd", "0603"],
      attributes: [{ key: "resistance", label: "抵抗値", value: "10", unit: "kΩ" }],
    });
    expect(text).toContain("smd");
    expect(text).toContain("0603");
    expect(text).toContain("resistance");
    expect(text).toContain("抵抗値");
    expect(text).toContain("10");
    expect(text).toContain("kω");
  });
});
