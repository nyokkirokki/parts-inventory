import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dependency advisory regression invariants", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    version: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const lock = readFileSync("pnpm-lock.yaml", "utf8");

  it("uses a patched SheetJS release from the vendor CDN", () => {
    expect(pkg.dependencies.xlsx).toBe("https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz");
    expect(lock).toContain("xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz");
  });
  it("does not ship the build-time Vite React plugin as a runtime dependency", () => {
    expect(pkg.dependencies["@vitejs/plugin-react"]).toBeUndefined();
    expect(pkg.devDependencies["@vitejs/plugin-react"]).toBeTruthy();
  });
  it("releases the minor version after the regression gate", () => {
    expect(pkg.version).toBe("0.2.0");
  });
});
