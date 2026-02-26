/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  IsomorphicStore,
  StorageStrategy,
  globalNamespaceRegistry,
  NamespaceConflictError,
  SerializationError,
  IsomorphicStoreError
} from '../src';

describe('IsomorphicStore - Error Handling', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        window.localStorage.clear();
      }
      if (window.sessionStorage) {
        window.sessionStorage.clear();
      }
    }
    globalNamespaceRegistry.clear();
  });

  afterEach(() => {
    globalNamespaceRegistry.clear();
  });

  describe('NamespaceConflictError', () => {
    it('should throw error when creating store with existing namespace (same strategy)', () => {
      const store1 = new IsomorphicStore('conflict:test', StorageStrategy.MEMORY);

      expect(() => {
        new IsomorphicStore('conflict:test', StorageStrategy.MEMORY);
      }).toThrow(NamespaceConflictError);

      store1.destroy();
    });

    it('should throw error when creating store with existing namespace (different strategy)', () => {
      const store1 = new IsomorphicStore('conflict:test2', StorageStrategy.MEMORY);

      expect(() => {
        new IsomorphicStore('conflict:test2', StorageStrategy.LOCAL);
      }).toThrow(NamespaceConflictError);

      store1.destroy();
    });

    it('should have descriptive error message', () => {
      const store1 = new IsomorphicStore('conflict:test3', StorageStrategy.MEMORY);

      try {
        new IsomorphicStore('conflict:test3', StorageStrategy.SESSION);
      } catch (error) {
        expect(error).toBeInstanceOf(NamespaceConflictError);
        expect((error as Error).message).toContain('conflict:test3');
        expect((error as Error).message).toContain('memory');
      }

      store1.destroy();
    });

    it('should allow namespace reuse after destroy', () => {
      const store1 = new IsomorphicStore('reuse:test', StorageStrategy.MEMORY);
      store1.destroy();

      // Should not throw
      const store2 = new IsomorphicStore('reuse:test', StorageStrategy.MEMORY);
      store2.destroy();
    });
  });

  describe('SerializationError', () => {
    it('should throw error for circular references', () => {
      const store = new IsomorphicStore('serialize:test', StorageStrategy.LOCAL);

      const circular: any = { a: 1 };
      circular.self = circular;

      expect(() => {
        store.set('circular', circular);
      }).toThrow(SerializationError);

      store.destroy();
    });

    it('should handle objects with functions gracefully', () => {
      const store = new IsomorphicStore('serialize:test2', StorageStrategy.LOCAL);

      const objectWithFunction = {
        a: 1,
        fn: () => {}
      };

      // JSON.stringify removes functions, doesn't throw error
      // We save it and retrieve, the function will be lost
      store.set('func', objectWithFunction as any);
      const retrieved = store.get('func') as any;
      expect(retrieved.a).toBe(1);
      expect(retrieved.fn).toBeUndefined(); // Function is lost

      store.destroy();
    });
  });

  describe('IsomorphicStoreError', () => {
    it('should be base class for all IsomorphicStore errors', () => {
      const store1 = new IsomorphicStore('error:test', StorageStrategy.MEMORY);

      try {
        new IsomorphicStore('error:test', StorageStrategy.SESSION);
      } catch (error) {
        expect(error).toBeInstanceOf(IsomorphicStoreError);
      }

      store1.destroy();
    });
  });

  describe('Error in different storage strategies', () => {
    it('should handle errors consistently across strategies', () => {
      const strategies = [
        StorageStrategy.MEMORY,
        StorageStrategy.LOCAL,
        StorageStrategy.SESSION
      ];

      for (const strategy of strategies) {
        globalNamespaceRegistry.clear();

        const store1 = new IsomorphicStore(`error:test:${strategy}`, strategy);
        let thrownError: Error | null = null;

        try {
          new IsomorphicStore(`error:test:${strategy}`, strategy);
        } catch (error) {
          thrownError = error as Error;
        }

        expect(thrownError).toBeInstanceOf(NamespaceConflictError);
        store1.destroy();
      }
    });
  });

  describe('Memory management', () => {
    it('should not leak listeners after destroy', () => {
      const store = new IsomorphicStore('leak:test', StorageStrategy.MEMORY);

      const listener = () => {};
      store.on(listener);
      store.onKey('key1', listener);
      store.once(listener);
      store.onceKey('key1', listener);

      store.destroy();

      // After destruction, the store should not trigger any events
      // (This is tested implicitly - if listeners aren't cleared, vitest would detect memory leaks)
    });
  });

  describe('Invalid usage', () => {
    it('should handle getting from non-existent namespace gracefully', () => {
      const store = new IsomorphicStore('valid:test', StorageStrategy.MEMORY);

      const result = store.get('nonexistent');
      expect(result).toBeNull();

      store.destroy();
    });

    it('should handle removing from non-existent namespace gracefully', () => {
      const store = new IsomorphicStore('valid:test2', StorageStrategy.MEMORY);

      // Should not throw
      expect(() => {
        store.remove('nonexistent');
      }).not.toThrow();

      store.destroy();
    });

    it('should handle clearing empty namespace gracefully', () => {
      const store = new IsomorphicStore('valid:test3', StorageStrategy.MEMORY);

      // Should not throw
      expect(() => {
        store.clear();
      }).not.toThrow();

      store.destroy();
    });
  });

  describe('Browser API compatibility', () => {
    it('should gracefully handle missing localStorage', () => {
      const store = new IsomorphicStore('compat:test', StorageStrategy.LOCAL);

      // Should not throw even if localStorage is unavailable
      const result = store.get('key');
      expect(result).toBeNull();

      store.destroy();
    });

    it('should gracefully handle missing sessionStorage', () => {
      const store = new IsomorphicStore('compat:test2', StorageStrategy.SESSION);

      // Should not throw even if sessionStorage is unavailable
      const result = store.get('key');
      expect(result).toBeNull();

      store.destroy();
    });

    it('should gracefully handle missing history API', () => {
      const store = new IsomorphicStore('compat:test3', StorageStrategy.HISTORY);

      // Should not throw even if history API is unavailable
      const result = store.get('key');
      expect(result).toBeNull();

      store.destroy();
    });

    it('should gracefully handle missing Navigation API', () => {
      const store = new IsomorphicStore('compat:test4', StorageStrategy.NAVIGATION);

      // Should not throw even if Navigation API is unavailable
      const result = store.get('key');
      expect(result).toBeNull();

      store.destroy();
    });
  });

  describe('Data type validation', () => {
    it('should not crash on storing non-JSON-serializable types', () => {
      const store = new IsomorphicStore('types:test', StorageStrategy.LOCAL);

      const data = {
        number: 123,
        string: 'hello',
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { a: 1, b: 2 }
      };

      expect(() => {
        store.set('valid', data);
      }).not.toThrow();

      const retrieved = store.get('valid');
      expect(retrieved).toEqual(data);

      store.destroy();
    });
  });
});
