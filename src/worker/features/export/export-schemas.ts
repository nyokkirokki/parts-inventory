export type ExportColumn = {
  key: string;
  header: string;
  source: "part" | "attribute" | "computed";
};

export type CategoryExportSchema = {
  categorySlug: string;
  sheetName: string;
  columns: ExportColumn[];
};

const baseColumns: ExportColumn[] = [
  { key: "categoryName", header: "カテゴリ", source: "part" },
  { key: "modelNumber", header: "型番", source: "part" },
  { key: "stockQuantity", header: "在庫数", source: "part" },
  { key: "price", header: "価格", source: "part" },
  { key: "location", header: "保管場所", source: "computed" },
  { key: "tags", header: "タグ", source: "computed" },
  { key: "memo", header: "メモ", source: "part" },
  { key: "lowStockThreshold", header: "低在庫しきい値", source: "part" },
];

const schemas: CategoryExportSchema[] = [
  {
    categorySlug: "rf-transceiver",
    sheetName: "RFトランシーバ",
    columns: [
      ...baseColumns,
      { key: "frequency", header: "周波数", source: "attribute" },
      { key: "voltage", header: "電圧", source: "attribute" },
      { key: "modulation", header: "通信方式", source: "attribute" },
      { key: "interface", header: "インターフェース", source: "attribute" },
    ],
  },
  {
    categorySlug: "resistor",
    sheetName: "抵抗",
    columns: [
      ...baseColumns,
      { key: "resistance", header: "抵抗値", source: "attribute" },
      { key: "tolerance", header: "許容差", source: "attribute" },
      { key: "package", header: "パッケージ", source: "attribute" },
      { key: "power_rating", header: "定格電力", source: "attribute" },
    ],
  },
];

const fallbackSchema: CategoryExportSchema = {
  categorySlug: "default",
  sheetName: "Parts",
  columns: [...baseColumns, { key: "primaryAttributes", header: "主要特性", source: "computed" }],
};

export function getExportSchema(categorySlug: string, categoryName?: string): CategoryExportSchema {
  // 未定義カテゴリのシート名はスラッグ(item-xxxx等)ではなくカテゴリ表示名を優先する。
  return schemas.find((schema) => schema.categorySlug === categorySlug) ?? {
    ...fallbackSchema,
    categorySlug,
    sheetName: categoryName?.trim() || categorySlug,
  };
}
