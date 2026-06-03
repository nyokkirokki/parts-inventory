import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildRowsForBlock,
  defaultMapping,
  guessTarget,
  parseWorkbook,
  type BlockMapping,
  type BuildOptions,
  type ExcelBlock,
} from "../../src/web/lib/excel-parser";

const defaultOptions: BuildOptions = {
  blockTitleAsTag: false,
  statusAsTag: false,
  lowStockThreshold: 0,
};

function makeBlock(overrides: Partial<ExcelBlock> = {}): ExcelBlock {
  return {
    id: "S#0",
    sheetName: "抵抗",
    blockTitle: "抵抗",
    status: "",
    headers: [],
    rows: [],
    signature: "sig",
    ...overrides,
  };
}

// Build an ArrayBuffer workbook from a 2D grid (one sheet) for parseWorkbook tests.
function gridToWorkbook(sheetName: string, grid: (string | number)[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(grid);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out instanceof ArrayBuffer ? out : new Uint8Array(out).buffer;
}

describe("guessTarget", () => {
  it("maps identity headers to model_number", () => {
    const headers = ["型番", "在庫数"];
    expect(guessTarget("型番", headers)).toBe("model_number");
    expect(guessTarget("品番", headers)).toBe("model_number");
    expect(guessTarget("アイテム名", headers)).toBe("model_number");
  });

  it("treats 定数/大きさ as identifier when there is no item-name column", () => {
    const headers = ["定数", "大きさ", "量"];
    expect(guessTarget("定数", headers)).toBe("identifier");
    expect(guessTarget("大きさ", headers)).toBe("identifier");
  });

  it("treats 定数/大きさ as attribute/footprint when an item-name column exists", () => {
    const headers = ["型番", "定数", "大きさ"];
    expect(guessTarget("定数", headers)).toBe("attribute");
    expect(guessTarget("大きさ", headers)).toBe("footprint");
  });

  it("maps stock, price, footprint, memo, manufacturer synonyms", () => {
    const headers = ["在庫数"];
    expect(guessTarget("在庫数", headers)).toBe("stock_quantity");
    expect(guessTarget("量・特性", headers)).toBe("stock_quantity");
    expect(guessTarget("単価", headers)).toBe("price");
    expect(guessTarget("パッケージ", headers)).toBe("footprint");
    expect(guessTarget("備考", headers)).toBe("memo");
    expect(guessTarget("メーカー", headers)).toBe("manufacturer");
  });

  it("falls back to attribute for unknown headers and ignores whitespace", () => {
    expect(guessTarget("謎の列", ["謎の列"])).toBe("attribute");
    expect(guessTarget(" 型番 ", ["型番"])).toBe("model_number");
  });
});

describe("defaultMapping", () => {
  it("builds an index-keyed mapping using guessTarget", () => {
    const headers = ["型番", "在庫数", "単価"];
    expect(defaultMapping(headers)).toEqual({ 0: "model_number", 1: "stock_quantity", 2: "price" });
  });
});

describe("buildRowsForBlock", () => {
  it("joins identifier columns into the model number and records them as attributes", () => {
    const block = makeBlock({
      headers: ["定数", "大きさ", "量"],
      rows: [["10k", "0603", "25"]],
    });
    const mapping: BlockMapping = { 0: "identifier", 1: "identifier", 2: "stock_quantity" };

    const [row] = buildRowsForBlock(block, mapping, defaultOptions);

    expect(row.model_number).toBe("10k 0603");
    expect(row.name).toBe("10k 0603"); // name falls back to model
    expect(row.stock_quantity).toBe(25);
    expect(row.attributes_json).toEqual({
      定数: { value: "10k", label: "定数" },
      大きさ: { value: "0603", label: "大きさ" },
    });
  });

  it("prefers an explicit model_number over joined identifiers", () => {
    const block = makeBlock({ headers: ["型番", "定数"], rows: [["R-001", "10k"]] });
    const mapping: BlockMapping = { 0: "model_number", 1: "identifier" };

    const [row] = buildRowsForBlock(block, mapping, defaultOptions);

    expect(row.model_number).toBe("R-001");
  });

  it("extracts numbers from messy stock cells and rounds them", () => {
    const block = makeBlock({ headers: ["型番", "量"], rows: [["R-001", "約12.6個"]] });
    const mapping: BlockMapping = { 0: "model_number", 1: "stock_quantity" };

    const [row] = buildRowsForBlock(block, mapping, defaultOptions);

    expect(row.stock_quantity).toBe(13);
  });

  it("falls back stock to 0 and preserves the raw text in memo when not numeric", () => {
    const block = makeBlock({ headers: ["型番", "量"], rows: [["R-001", "在庫なし"]] });
    const mapping: BlockMapping = { 0: "model_number", 1: "stock_quantity" };

    const [row] = buildRowsForBlock(block, mapping, defaultOptions);

    expect(row.stock_quantity).toBe(0);
    expect(row.memo).toBe("量:在庫なし");
  });

  it("ignores negative price and concatenates multiple memo columns", () => {
    const block = makeBlock({
      headers: ["型番", "単価", "備考", "注記"],
      rows: [["R-001", "-5", "first", "second"]],
    });
    const mapping: BlockMapping = { 0: "model_number", 1: "price", 2: "memo", 3: "memo" };

    const [row] = buildRowsForBlock(block, mapping, defaultOptions);

    expect(row.price).toBeNull();
    expect(row.memo).toBe("first / second");
  });

  it("drops rows that have neither a model number nor identifier", () => {
    const block = makeBlock({ headers: ["型番", "量"], rows: [["", "25"]] });
    const mapping: BlockMapping = { 0: "model_number", 1: "stock_quantity" };

    expect(buildRowsForBlock(block, mapping, defaultOptions)).toHaveLength(0);
  });

  it("emits blockTitle and status as deduplicated, split tags when enabled", () => {
    const block = makeBlock({
      blockTitle: "面実装 チップ",
      status: "使用OK／チップ",
      headers: ["型番"],
      rows: [["R-001"]],
    });
    const mapping: BlockMapping = { 0: "model_number" };

    const [row] = buildRowsForBlock(block, mapping, {
      ...defaultOptions,
      blockTitleAsTag: true,
      statusAsTag: true,
    });

    expect(row.tags?.split(",").sort()).toEqual(["チップ", "使用OK", "面実装"]);
  });

  it("does not add blockTitle tag when it equals the sheet name", () => {
    const block = makeBlock({ blockTitle: "抵抗", sheetName: "抵抗", headers: ["型番"], rows: [["R-001"]] });
    const mapping: BlockMapping = { 0: "model_number" };

    const [row] = buildRowsForBlock(block, mapping, { ...defaultOptions, blockTitleAsTag: true });

    expect(row.tags).toBeUndefined();
  });
});

describe("parseWorkbook (irregular multi-block detection)", () => {
  it("detects two side-by-side blocks split by an empty column", () => {
    // Columns 0-1 are block A, column 2 is an empty separator, columns 3-4 are block B.
    const grid: (string | number)[][] = [
      ["面実装", "", "", "リード", ""],
      ["型番", "量", "", "型番", "量"],
      ["R-001", "10", "", "R-101", "5"],
      ["R-002", "20", "", "", ""],
    ];

    const blocks = parseWorkbook(gridToWorkbook("抵抗", grid));

    expect(blocks).toHaveLength(2);
    expect(blocks[0].sheetName).toBe("抵抗");
    expect(blocks[0].headers).toEqual(["型番", "量"]);
    expect(blocks[0].rows).toEqual([
      ["R-001", "10"],
      ["R-002", "20"],
    ]);
    expect(blocks[0].blockTitle).toBe("面実装");
    expect(blocks[1].headers).toEqual(["型番", "量"]);
    expect(blocks[1].rows).toEqual([["R-101", "5"]]);
    expect(blocks[1].blockTitle).toBe("リード");
  });

  it("skips meta sheets and sheets without an identity header row", () => {
    const meta = parseWorkbook(gridToWorkbook("変更履歴", [["日付", "内容"], ["2026", "x"]]));
    expect(meta).toHaveLength(0);

    const noHeader = parseWorkbook(gridToWorkbook("その他", [["説明", "値"], ["a", "b"]]));
    expect(noHeader).toHaveLength(0);
  });

  it("excludes repeated header rows and section-heading rows inside a block", () => {
    const grid: (string | number)[][] = [
      ["型番", "量", "単価"],
      ["セクションA", "", ""], // section heading: only first col filled -> excluded (>=3 cols)
      ["R-001", "10", "5"],
      ["型番", "量", "単価"], // repeated header row -> excluded
      ["R-002", "20", "6"],
    ];

    const [block] = parseWorkbook(gridToWorkbook("抵抗", grid));

    expect(block.rows).toEqual([
      ["R-001", "10", "5"],
      ["R-002", "20", "6"],
    ]);
  });
});
