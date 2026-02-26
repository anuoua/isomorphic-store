/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { IsomorphicStore, StorageStrategy, globalNamespaceRegistry } from "../src";

describe("IsomorphicStore - Smoke Test", () => {
  it("should export all public APIs", () => {
    expect(IsomorphicStore).toBeDefined();
    expect(StorageStrategy).toBeDefined();
    expect(globalNamespaceRegistry).toBeDefined();
  });

  it("should create a basic IsomorphicStore instance", () => {
    globalNamespaceRegistry.clear();
    const store = new IsomorphicStore("smoke:test", StorageStrategy.MEMORY);
    expect(store).toBeDefined();
    store.destroy();
  });

  it("should perform basic operations", () => {
    globalNamespaceRegistry.clear();
    const store = new IsomorphicStore("smoke:ops", StorageStrategy.MEMORY);

    store.set("key", "value");
    expect(store.get("key")).toBe("value");

    store.remove("key");
    expect(store.get("key")).toBeNull();

    store.destroy();
  });
});
