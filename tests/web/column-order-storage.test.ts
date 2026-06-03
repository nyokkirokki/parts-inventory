import { describe, expect, it } from "vitest";
import {
  COLUMN_ORDER_STORAGE_KEY,
  getColumnOrderScope,
  getStoredColumnOrder,
  removeStoredColumnOrder,
  setStoredColumnOrder,
} from "../../src/web/lib/column-order-storage";

function memoryStorage(initialValue?: string): Storage {
  const store = new Map<string, string>();
  if (initialValue !== undefined) store.set(COLUMN_ORDER_STORAGE_KEY, initialValue);

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => store.delete(key),
    setItem: (key, value) => store.set(key, value),
  };
}

describe("column order storage", () => {
  it("reads legacy global arrays as the default header order", () => {
    const storage = memoryStorage(JSON.stringify(["manufacturer", "modelNumber"]));

    expect(getStoredColumnOrder(getColumnOrderScope(null), storage)).toEqual(["manufacturer", "modelNumber"]);
    expect(getStoredColumnOrder(getColumnOrderScope("3"), storage)).toBeNull();
  });

  it("stores default and category header orders independently", () => {
    const storage = memoryStorage();

    setStoredColumnOrder(getColumnOrderScope(null), ["modelNumber", "stockQuantity"], storage);
    setStoredColumnOrder(getColumnOrderScope("3"), ["attr_resistance", "modelNumber"], storage);

    expect(getStoredColumnOrder(getColumnOrderScope(null), storage)).toEqual(["modelNumber", "stockQuantity"]);
    expect(getStoredColumnOrder(getColumnOrderScope("3"), storage)).toEqual(["attr_resistance", "modelNumber"]);
  });

  it("removes only the requested header order scope", () => {
    const storage = memoryStorage();
    setStoredColumnOrder(getColumnOrderScope(null), ["modelNumber"], storage);
    setStoredColumnOrder(getColumnOrderScope("3"), ["attr_resistance"], storage);

    removeStoredColumnOrder(getColumnOrderScope("3"), storage);

    expect(getStoredColumnOrder(getColumnOrderScope(null), storage)).toEqual(["modelNumber"]);
    expect(getStoredColumnOrder(getColumnOrderScope("3"), storage)).toBeNull();
  });
});
