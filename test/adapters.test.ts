/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  IsomorphicStore,
  StorageStrategy,
  globalNamespaceRegistry,
  MemoryStorageAdapter,
  LocalStorageAdapter,
  SessionStorageAdapter,
  HistoryStateAdapter,
  NavigationStateAdapter
} from '../src';

describe('Storage Adapters', () => {
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

  describe('MemoryStorageAdapter', () => {
    it('should implement IStorageAdapter interface', () => {
      const adapter = new MemoryStorageAdapter();

      expect(typeof adapter.get).toBe('function');
      expect(typeof adapter.set).toBe('function');
      expect(typeof adapter.remove).toBe('function');
      expect(typeof adapter.clear).toBe('function');
      expect(typeof adapter.hasKey).toBe('function');
    });

    it('should store and retrieve data', () => {
      const adapter = new MemoryStorageAdapter<string>();

      adapter.set('key1', 'value1');
      expect(adapter.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      const adapter = new MemoryStorageAdapter();

      expect(adapter.get('nonexistent')).toBeNull();
    });

    it('should remove data', () => {
      const adapter = new MemoryStorageAdapter<string>();

      adapter.set('key1', 'value1');
      adapter.remove('key1');
      expect(adapter.get('key1')).toBeNull();
    });

    it('should clear all data', () => {
      const adapter = new MemoryStorageAdapter<string>();

      adapter.set('key1', 'value1');
      adapter.set('key2', 'value2');
      adapter.clear();

      expect(adapter.get('key1')).toBeNull();
      expect(adapter.get('key2')).toBeNull();
    });

    it('should check if key exists', () => {
      const adapter = new MemoryStorageAdapter<string>();

      expect(adapter.hasKey('key1')).toBe(false);
      adapter.set('key1', 'value1');
      expect(adapter.hasKey('key1')).toBe(true);
    });
  });

  describe('LocalStorageAdapter', () => {
    it('should store data in localStorage', () => {
      const adapter = new LocalStorageAdapter<string>('testns');

      adapter.set('key1', 'value1');
      expect(window.localStorage.getItem('testns:key1')).toBeTruthy();
    });

    it('should retrieve data from localStorage', () => {
      const adapter = new LocalStorageAdapter<string>('testns');

      adapter.set('key1', 'value1');
      expect(adapter.get('key1')).toBe('value1');
    });

    it('should handle structured data', () => {
      const adapter = new LocalStorageAdapter<{ a: number; b: string }>('testns');
      const data = { a: 1, b: 'test' };

      adapter.set('key1', data);
      const retrieved = adapter.get('key1');
      expect(retrieved).toEqual(data);
    });

    it('should remove data from localStorage', () => {
      const adapter = new LocalStorageAdapter<string>('testns');

      adapter.set('key1', 'value1');
      adapter.remove('key1');
      expect(window.localStorage.getItem('testns:key1')).toBeNull();
    });

    it('should persist across adapter instances', () => {
      const adapter1 = new LocalStorageAdapter<string>('testns');
      adapter1.set('key1', 'value1');

      const adapter2 = new LocalStorageAdapter<string>('testns');
      expect(adapter2.get('key1')).toBe('value1');
    });
  });

  describe('SessionStorageAdapter', () => {
    it('should store data in sessionStorage', () => {
      const adapter = new SessionStorageAdapter<string>('testns');

      adapter.set('key1', 'value1');
      expect(window.sessionStorage.getItem('testns:key1')).toBeTruthy();
    });

    it('should retrieve data from sessionStorage', () => {
      const adapter = new SessionStorageAdapter<string>('testns');

      adapter.set('key1', 'value1');
      expect(adapter.get('key1')).toBe('value1');
    });

    it('should handle structured data', () => {
      const adapter = new SessionStorageAdapter<{ a: number; b: string }>('testns');
      const data = { a: 1, b: 'test' };

      adapter.set('key1', data);
      const retrieved = adapter.get('key1');
      expect(retrieved).toEqual(data);
    });

    it('should remove data from sessionStorage', () => {
      const adapter = new SessionStorageAdapter<string>('testns');

      adapter.set('key1', 'value1');
      adapter.remove('key1');
      expect(window.sessionStorage.getItem('testns:key1')).toBeNull();
    });
  });

  describe('HistoryStateAdapter', () => {
    it('should initialize state in history.state', () => {
      const adapter = new HistoryStateAdapter('test:namespace');

      expect(window.history.state).toBeDefined();
      expect(window.history.state['test:namespace']).toBeDefined();
    });

    it('should store and retrieve data from history state', () => {
      const adapter = new HistoryStateAdapter<string>('test:namespace2');

      adapter.set('key1', 'value1');
      expect(adapter.get('key1')).toBe('value1');
    });

    it('should maintain separate namespaces', () => {
      const adapter1 = new HistoryStateAdapter<string>('namespace1');
      const adapter2 = new HistoryStateAdapter<string>('namespace2');

      adapter1.set('key', 'value1');
      adapter2.set('key', 'value2');

      expect(adapter1.get('key')).toBe('value1');
      expect(adapter2.get('key')).toBe('value2');
    });

    it('should remove data from history state', () => {
      const adapter = new HistoryStateAdapter<string>('test:namespace3');

      adapter.set('key1', 'value1');
      adapter.remove('key1');
      expect(adapter.get('key1')).toBeNull();
    });

    it('should clear namespace data', () => {
      const adapter = new HistoryStateAdapter<string>('test:namespace4');

      adapter.set('key1', 'value1');
      adapter.set('key2', 'value2');
      adapter.clear();

      expect(adapter.get('key1')).toBeNull();
      expect(adapter.get('key2')).toBeNull();
    });
  });

  describe('NavigationStateAdapter', () => {
    it('should handle missing Navigation API gracefully', () => {
      const adapter = new NavigationStateAdapter('test:nav');

      // Should not throw even if Navigation API is not available
      expect(() => {
        adapter.set('key1', 'value1');
      }).not.toThrow();

      expect(adapter.get('key1')).toBeNull();
    });

    it('should gracefully handle null currentEntry', () => {
      const adapter = new NavigationStateAdapter('test:nav2');

      // Should not crash
      const result = adapter.hasKey('key1');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Adapter integration with IsomorphicStore', () => {
    it('MEMORY strategy should use MemoryStorageAdapter', () => {
      const store = new IsomorphicStore('test:memory', StorageStrategy.MEMORY);

      store.set('key1', 'value1');
      expect(store.get('key1')).toBe('value1');

      store.destroy();
    });

    it('LOCAL strategy should use LocalStorageAdapter', () => {
      const store = new IsomorphicStore('test:local', StorageStrategy.LOCAL);

      store.set('key1', 'value1');
      expect(window.localStorage.getItem('test:local:key1')).toBeTruthy();
      expect(store.get('key1')).toBe('value1');

      store.destroy();
    });

    it('SESSION strategy should use SessionStorageAdapter', () => {
      const store = new IsomorphicStore('test:session', StorageStrategy.SESSION);

      store.set('key1', 'value1');
      expect(window.sessionStorage.getItem('test:session:key1')).toBeTruthy();
      expect(store.get('key1')).toBe('value1');

      store.destroy();
    });

    it('HISTORY strategy should use HistoryStateAdapter', () => {
      const store = new IsomorphicStore('test:history', StorageStrategy.HISTORY);

      store.set('key1', 'value1');
      expect(window.history.state['test:history']['key1']).toBeTruthy();
      expect(store.get('key1')).toBe('value1');

      store.destroy();
    });
  });

  describe('Adapter data isolation', () => {
    it('should isolate data between different adapters', () => {
      const memoryStore = new IsomorphicStore('isolated:mem', StorageStrategy.MEMORY);
      const localStore = new IsomorphicStore('isolated:local', StorageStrategy.LOCAL);

      memoryStore.set('key', 'memory-value');
      localStore.set('key', 'local-value');

      expect(memoryStore.get('key')).toBe('memory-value');
      expect(localStore.get('key')).toBe('local-value');

      memoryStore.destroy();
      localStore.destroy();
    });

    it('should isolate data between different namespaces in same adapter', () => {
      const store1 = new IsomorphicStore('namespace1', StorageStrategy.LOCAL);
      const store2 = new IsomorphicStore('namespace2', StorageStrategy.LOCAL);

      store1.set('key', 'value1');
      store2.set('key', 'value2');

      expect(store1.get('key')).toBe('value1');
      expect(store2.get('key')).toBe('value2');

      store1.destroy();
      store2.destroy();
    });
  });

  describe('Adapter null handling', () => {
    it('LocalStorageAdapter should handle null values', () => {
      const adapter = new LocalStorageAdapter<string | null>('testns');

      adapter.set('key1', null as any);
      const result = adapter.get('key1');
      // JSON.stringify(null) = 'null', so it should be retrieved as null
      expect(result).toBe(null);
    });

    it('MemoryStorageAdapter should return null for missing keys', () => {
      const adapter = new MemoryStorageAdapter();

      expect(adapter.get('missing')).toBe(null);
    });
  });
});
