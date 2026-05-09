/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  IsomorphicStore,
  StorageStrategy,
  globalNamespaceRegistry,
  StorageAdapterFactory
} from '../src';

describe('IsomorphicStore - Integration Tests', () => {
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
      type PrefsSchema = { theme: string; fontSize: number };
      const store = new IsomorphicStore<PrefsSchema>(
        'app.prefs',
        StorageStrategy.LOCAL
      );

      store.set('theme', 'dark');
      store.set('fontSize', 14);

      expect(store.get('theme')).toBe('dark');
      expect(store.get('fontSize')).toBe(14);

      store.set('theme', 'light');
      expect(store.get('theme')).toBe('light');

      store.destroy();
    });

    it('should handle session data workflow', () => {
      type SessionSchema = { auth: { userId: number; token: string } };
      const sessionStore = new IsomorphicStore<SessionSchema>(
        'app.session',
        StorageStrategy.SESSION
      );

      sessionStore.set('auth', { userId: 123, token: 'abc-def' });

      const auth = sessionStore.get('auth');
      expect(auth?.userId).toBe(123);

      sessionStore.remove('auth');
      expect(sessionStore.get('auth')).toBeNull();

      sessionStore.destroy();
    });

    it('should handle multi-store coordination', () => {
      type ConfigSchema = { config: { apiUrl: string } };
      const localStorage = new IsomorphicStore<ConfigSchema>('app.local', StorageStrategy.LOCAL);
      const memoryStore = new IsomorphicStore<ConfigSchema>('app.memory', StorageStrategy.MEMORY);

      const saved = localStorage.get('config');
      if (saved === null) {
        const defaultConfig = { apiUrl: 'https://api.example.com' };
        localStorage.set('config', defaultConfig);
        memoryStore.set('config', defaultConfig);
      } else {
        memoryStore.set('config', saved);
      }

      let config = memoryStore.get('config');
      expect(config?.apiUrl).toBe('https://api.example.com');

      config = memoryStore.get('config');
      if (config) localStorage.set('config', config);

      const savedConfig = localStorage.get('config');
      expect(savedConfig?.apiUrl).toBe('https://api.example.com');

      localStorage.destroy();
      memoryStore.destroy();
    });

    it('should handle data migration on app update', () => {
      // Version 1: Old format
      const storeV1 = new IsomorphicStore<any>('app.data', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('user', {
        name: 'John',
        email: 'john@example.com'
      });
      storeV1.destroy();

      // Version 2: New format with migration
      const storeV2 = new IsomorphicStore<any>('app.data', StorageStrategy.LOCAL, {
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

      const migratedUser = storeV2.get('user') as any;
      expect(migratedUser.profile.displayName).toBe('John');
      expect(migratedUser.profile.email).toBe('john@example.com');
      expect(migratedUser.profile.createdAt).toBeDefined();

      storeV2.destroy();
    });

    it('should handle caching workflow', () => {
      type CacheSchema = { query1: { data: string; timestamp: number } };
      const cache = new IsomorphicStore<CacheSchema>(
        'app.cache',
        StorageStrategy.MEMORY
      );

      const apiCall = () => {
        return { data: 'expensive result', timestamp: Date.now() };
      };

      let cachedResult = cache.get('query1');

      if (cachedResult === null) {
        const result = apiCall();
        cache.set('query1', result);
        cachedResult = result;
      }

      expect(cachedResult!.data).toBe('expensive result');

      const cachedResult2 = cache.get('query1');
      expect(cachedResult2).toEqual(cachedResult);

      cache.destroy();
    });

    it('should handle form state recovery', () => {
      type FormSchema = {
        state: { step: number; data: Record<string, any> };
      };
      const historyStore = new IsomorphicStore<FormSchema>(
        'app.form',
        StorageStrategy.HISTORY
      );

      historyStore.set('state', {
        step: 1,
        data: { name: 'Alice', email: 'alice@example.com' }
      });

      historyStore.set('state', {
        step: 2,
        data: { name: 'Alice', email: 'alice@example.com', phone: '123-456' }
      });

      let state = historyStore.get('state');
      expect(state?.step).toBe(2);
      expect(state?.data.phone).toBe('123-456');

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

        const store = new IsomorphicStore('factory:test', strategy);
        expect(store).toBeDefined();
        store.destroy();
      }
    });
  });

  describe('Cross-instance communication', () => {
    it('should support listener-based updates across instances', () => {
      const store1 = new IsomorphicStore('shared:data', StorageStrategy.LOCAL);
      const store2 = new IsomorphicStore('different:namespace', StorageStrategy.LOCAL);

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
      const store = new IsomorphicStore('perf:test', StorageStrategy.MEMORY);

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
      const store = new IsomorphicStore('perf:large', StorageStrategy.LOCAL);

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
      const store = new IsomorphicStore('cleanup:test', StorageStrategy.MEMORY);

      const listener = () => {};
      store.on(listener);
      store.onKey('key', listener);

      store.destroy();

      // Registry should be cleared
      expect(globalNamespaceRegistry.has('cleanup:test')).toBe(false);

      // Should be able to recreate store with same namespace
      const store2 = new IsomorphicStore('cleanup:test', StorageStrategy.MEMORY);
      store2.destroy();
    });

    it('should not trigger listeners after destroy', () => {
      const store = new IsomorphicStore('cleanup:test2', StorageStrategy.MEMORY);

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
      const store = new IsomorphicStore('rapid:test', StorageStrategy.MEMORY);

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
        new IsomorphicStore('concurrent:1', StorageStrategy.MEMORY),
        new IsomorphicStore('concurrent:2', StorageStrategy.MEMORY),
        new IsomorphicStore('concurrent:3', StorageStrategy.MEMORY)
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
      const store = new IsomorphicStore('long:keys', StorageStrategy.LOCAL);

      const longKey = 'a'.repeat(1000);
      store.set(longKey, 'value');

      expect(store.get(longKey)).toBe('value');

      store.destroy();
    });
  });
});
