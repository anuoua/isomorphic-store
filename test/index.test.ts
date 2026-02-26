/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { DataStore, StorageStrategy, globalNamespaceRegistry } from "../src";

describe("DataStore - Smoke Test", () => {
  it("should export all public APIs", () => {
    expect(DataStore).toBeDefined();
    expect(StorageStrategy).toBeDefined();
    expect(globalNamespaceRegistry).toBeDefined();
  });

  it("should create a basic DataStore instance", () => {
    globalNamespaceRegistry.clear();
    const store = new DataStore("smoke:test", StorageStrategy.MEMORY);
    expect(store).toBeDefined();
    store.destroy();
  });

  it("should perform basic operations", () => {
    globalNamespaceRegistry.clear();
    const store = new DataStore("smoke:ops", StorageStrategy.MEMORY);

    store.set("key", "value");
    expect(store.get("key")).toBe("value");

    store.remove("key");
    expect(store.get("key")).toBeNull();

    store.destroy();
  });
});
