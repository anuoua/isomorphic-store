/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DataStore,
  StorageStrategy,
  globalNamespaceRegistry,
  StorageAdapterFactory
} from '../src';

describe('DataStore - Integration Tests', () => {
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

  describe('Real-world scenarios', () => {
    it('should handle user preferences workflow', () => {
      const store = new DataStore<{ theme: string; fontSize: number }>(
        'app.prefs',
        StorageStrategy.LOCAL
      );

      // User sets preferences
      store.set('theme', { theme: 'dark', fontSize: 14 } as any);

      // User modifies preferences
      let prefs = store.get('theme');
      expect(prefs?.theme).toBe('dark');

      // User changes theme
      store.set('theme', { theme: 'light', fontSize: 14 } as any);
      prefs = store.get('theme');
      expect(prefs?.theme).toBe('light');

      store.destroy();
    });

    it('should handle session data workflow', () => {
      const sessionStore = new DataStore<{ userId: number; token: string }>(
        'app.session',
        StorageStrategy.SESSION
      );

      // User logs in
      sessionStore.set('auth', { userId: 123, token: 'abc-def' } as any);

      // Check authentication
      const auth = sessionStore.get('auth');
      expect(auth?.userId).toBe(123);

      // User logs out
      sessionStore.remove('auth');
      expect(sessionStore.get('auth')).toBeNull();

      sessionStore.destroy();
    });

    it('should handle multi-store coordination', () => {
      const localStorage = new DataStore('app.local', StorageStrategy.LOCAL);
      const memoryStore = new DataStore('app.memory', StorageStrategy.MEMORY);

      // Initialize memory from localStorage
      const saved = localStorage.get('config');
      if (saved === null) {
        const defaultConfig = { apiUrl: 'https://api.example.com' };
        localStorage.set('config', defaultConfig as any);
        memoryStore.set('config', defaultConfig as any);
      } else {
        memoryStore.set('config', saved);
      }

      // Modify in memory
      let config = memoryStore.get('config');
      expect(config?.apiUrl).toBe('https://api.example.com');

      // Sync back to localStorage
      config = memoryStore.get('config');
      localStorage.set('config', config as any);

      const savedConfig = localStorage.get('config');
      expect(savedConfig?.apiUrl).toBe('https://api.example.com');

      localStorage.destroy();
      memoryStore.destroy();
    });

    it('should handle data migration on app update', () => {
      // Version 1: Old format
      const storeV1 = new DataStore<any>('app.data', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('user', {
        name: 'John',
        email: 'john@example.com'
      });
      storeV1.destroy();

      // Version 2: New format with migration
      const storeV2 = new DataStore<any>('app.data', StorageStrategy.LOCAL, {
        version: 2,
        migrations: [
          {
            from: 1,
            to: 2,
            migrate: (data: any) => ({
              profile: {
                displayName: data.name,
                email: data.email,
                createdAt: Date.now()
              }
            })
          }
        ]
      });

      const migratedUser = storeV2.get('user');
      expect(migratedUser.profile.displayName).toBe('John');
      expect(migratedUser.profile.email).toBe('john@example.com');
      expect(migratedUser.profile.createdAt).toBeDefined();

      storeV2.destroy();
    });

    it('should handle caching workflow', () => {
      const cache = new DataStore<{ data: string; timestamp: number }>(
        'app.cache',
        StorageStrategy.MEMORY
      );

      const apiCall = () => {
        return { data: 'expensive result', timestamp: Date.now() };
      };

      // Check cache
      let cachedResult = cache.get('query1');

      if (cachedResult === null) {
        // Cache miss - call API
        const result = apiCall();
        cache.set('query1', result as any);
        cachedResult = result as any;
      }

      expect(cachedResult.data).toBe('expensive result');

      // Second access - from cache
      const cachedResult2 = cache.get('query1');
      expect(cachedResult2).toEqual(cachedResult);

      cache.destroy();
    });

    it('should handle form state recovery', () => {
      const historyStore = new DataStore<{ step: number; data: Record<string, any> }>(
        'app.form',
        StorageStrategy.HISTORY
      );

      // User fills form step 1
      historyStore.set('state', {
        step: 1,
        data: { name: 'Alice', email: 'alice@example.com' }
      } as any);

      // User navigates to step 2
      historyStore.set('state', {
        step: 2,
        data: { name: 'Alice', email: 'alice@example.com', phone: '123-456' }
      } as any);

      // Check current state
      let state = historyStore.get('state');
      expect(state?.step).toBe(2);
      expect(state?.data.phone).toBe('123-456');

      // If user goes back (popstate), state would be restored
      // (In real scenario, browser handles this)

      historyStore.destroy();
    });
  });

  describe('Factory pattern', () => {
    it('should create correct adapter for each strategy', () => {
      const strategies = [
        StorageStrategy.LOCAL,
        StorageStrategy.SESSION,
        StorageStrategy.MEMORY,
        StorageStrategy.HISTORY,
        StorageStrategy.NAVIGATION
      ];

      for (const strategy of strategies) {
        globalNamespaceRegistry.clear();

        const store = new DataStore('factory:test', strategy);
        expect(store).toBeDefined();
        store.destroy();
      }
    });
  });

  describe('Cross-instance communication', () => {
    it('should support listener-based updates across instances', () => {
      const store1 = new DataStore('shared:data', StorageStrategy.LOCAL);
      const store2 = new DataStore('different:namespace', StorageStrategy.LOCAL);

      const store1Events: any[] = [];
      store1.on((event) => {
        store1Events.push(event);
      });

      // Store2 modifies its own data
      store2.set('key', 'value');

      // Store1 only receives its own updates
      store1.set('key', 'store1-value');

      expect(store1Events.length).toBe(1);
      expect(store1Events[0].key).toBe('key');

      store1.destroy();
      store2.destroy();
    });
  });

  describe('Performance considerations', () => {
    it('should efficiently handle large numbers of keys', () => {
      const store = new DataStore('perf:test', StorageStrategy.MEMORY);

      const startTime = performance.now();

      // Set 1000 keys
      for (let i = 0; i < 1000; i++) {
        store.set(`key${i}`, `value${i}`);
      }

      const setTime = performance.now() - startTime;

      const getStartTime = performance.now();

      // Get 1000 keys
      for (let i = 0; i < 1000; i++) {
        store.get(`key${i}`);
      }

      const getTime = performance.now() - getStartTime;

      // Verify all keys are there
      expect(store.get('key500')).toBe('value500');
      expect(store.get('key999')).toBe('value999');

      // Time should be reasonable (< 1 second total)
      expect(setTime + getTime).toBeLessThan(1000);

      store.destroy();
    });

    it('should handle large data objects efficiently', () => {
      const store = new DataStore('perf:large', StorageStrategy.LOCAL);

      const largeData = {
        items: Array(100)
          .fill(0)
          .map((_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
            tags: ['tag1', 'tag2', 'tag3'],
            metadata: { created: Date.now(), modified: Date.now() }
          }))
      };

      const startTime = performance.now();
      store.set('large', largeData as any);
      const setTime = performance.now() - startTime;

      const getStartTime = performance.now();
      const retrieved = store.get('large');
      const getTime = performance.now() - getStartTime;

      expect(retrieved).toEqual(largeData);
      expect(setTime + getTime).toBeLessThan(500); // Should be fast

      store.destroy();
    });
  });

  describe('Destroy and cleanup', () => {
    it('should properly cleanup resources on destroy', () => {
      const store = new DataStore('cleanup:test', StorageStrategy.MEMORY);

      const listener = () => {};
      store.on(listener);
      store.onKey('key', listener);

      store.destroy();

      // Registry should be cleared
      expect(globalNamespaceRegistry.has('cleanup:test')).toBe(false);

      // Should be able to recreate store with same namespace
      const store2 = new DataStore('cleanup:test', StorageStrategy.MEMORY);
      store2.destroy();
    });

    it('should not trigger listeners after destroy', () => {
      const store = new DataStore('cleanup:test2', StorageStrategy.MEMORY);

      const listener = () => {
        throw new Error('Should not be called');
      };

      store.on(listener);
      store.destroy();

      // This would throw if listener is still active, but it shouldn't
      expect(() => {
        store.set('key', 'value');
      }).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid sequential operations', () => {
      const store = new DataStore('rapid:test', StorageStrategy.MEMORY);

      // Rapid set operations
      for (let i = 0; i < 100; i++) {
        store.set('key', i);
      }

      // Final value should be 99
      expect(store.get('key')).toBe(99);

      store.destroy();
    });

    it('should handle concurrent-like operations', () => {
      const stores = [
        new DataStore('concurrent:1', StorageStrategy.MEMORY),
        new DataStore('concurrent:2', StorageStrategy.MEMORY),
        new DataStore('concurrent:3', StorageStrategy.MEMORY)
      ];

      // Simulate concurrent operations
      stores[0].set('data', 'store1');
      stores[1].set('data', 'store2');
      stores[2].set('data', 'store3');

      expect(stores[0].get('data')).toBe('store1');
      expect(stores[1].get('data')).toBe('store2');
      expect(stores[2].get('data')).toBe('store3');

      stores.forEach((s) => s.destroy());
    });

    it('should handle very long key names', () => {
      const store = new DataStore('long:keys', StorageStrategy.LOCAL);

      const longKey = 'a'.repeat(1000);
      store.set(longKey, 'value');

      expect(store.get(longKey)).toBe('value');

      store.destroy();
    });
  });
});
