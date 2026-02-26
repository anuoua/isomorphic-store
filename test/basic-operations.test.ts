/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataStore, StorageStrategy, globalNamespaceRegistry } from '../src';

describe('DataStore - Basic Operations', () => {
  let store: DataStore<any>;

  beforeEach(() => {
    // 清空所有存储
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
    if (store) {
      store.destroy();
    }
  });

  describe('MEMORY Strategy', () => {
    beforeEach(() => {
      store = new DataStore('test:memory', StorageStrategy.MEMORY);
    });

    it('should set and get data', () => {
      store.set('key1', 'value1');
      expect(store.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(store.get('nonexistent')).toBeNull();
    });

    it('should remove data', () => {
      store.set('key1', 'value1');
      expect(store.hasKey('key1')).toBe(true);
      store.remove('key1');
      expect(store.hasKey('key1')).toBe(false);
      expect(store.get('key1')).toBeNull();
    });

    it('should clear all data', () => {
      store.set('key1', 'value1');
      store.set('key2', 'value2');
      expect(store.get('key1')).toBe('value1');
      expect(store.get('key2')).toBe('value2');

      store.clear();
      expect(store.get('key1')).toBeNull();
      expect(store.get('key2')).toBeNull();
    });

    it('should check if key exists', () => {
      expect(store.hasKey('key1')).toBe(false);
      store.set('key1', 'value1');
      expect(store.hasKey('key1')).toBe(true);
    });

    it('should return default value for non-existent keys', () => {
      const defaultValue = 'default';
      expect(store.getOrDefault('nonexistent', defaultValue)).toBe(defaultValue);
      store.set('key1', 'value1');
      expect(store.getOrDefault('key1', defaultValue)).toBe('value1');
    });

    it('should support various data types', () => {
      const data = {
        string: 'value',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { a: 1, b: 2 }
      };

      store.set('complex', data);
      const retrieved = store.get('complex');
      expect(retrieved).toEqual(data);
    });

    it('should handle null and undefined', () => {
      store.set('nullValue', null);
      store.set('undefinedValue', undefined);

      expect(store.get('nullValue')).toBeNull();
      // undefined 会被 JSON 序列化为 undefined
      expect(store.get('undefinedValue')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      store.set('key1', 'value1');
      expect(store.get('key1')).toBe('value1');

      store.set('key1', 'value2');
      expect(store.get('key1')).toBe('value2');
    });
  });

  describe('LOCAL Strategy', () => {
    beforeEach(() => {
      store = new DataStore('test:local', StorageStrategy.LOCAL);
    });

    it('should set and get data from localStorage', () => {
      store.set('key1', 'value1');
      expect(store.get('key1')).toBe('value1');

      // 数据应该在 localStorage 中
      expect(window.localStorage.getItem('test:local:key1')).toBeTruthy();
    });

    it('should persist data across instances', () => {
      store.set('key1', 'value1');
      store.destroy();

      const newStore = new DataStore('test:local', StorageStrategy.LOCAL);
      expect(newStore.get('key1')).toBe('value1');
      newStore.destroy();
    });

    it('should clear data from localStorage', () => {
      store.set('key1', 'value1');
      store.set('key2', 'value2');

      store.clear();

      expect(store.get('key1')).toBeNull();
      expect(store.get('key2')).toBeNull();
      expect(window.localStorage.getItem('test:local:key1')).toBeNull();
      expect(window.localStorage.getItem('test:local:key2')).toBeNull();
    });
  });

  describe('SESSION Strategy', () => {
    beforeEach(() => {
      store = new DataStore('test:session', StorageStrategy.SESSION);
    });

    it('should set and get data from sessionStorage', () => {
      store.set('key1', 'value1');
      expect(store.get('key1')).toBe('value1');

      // 数据应该在 sessionStorage 中
      expect(window.sessionStorage.getItem('test:session:key1')).toBeTruthy();
    });

    it('should clear data from sessionStorage', () => {
      store.set('key1', 'value1');
      store.set('key2', 'value2');

      store.clear();

      expect(store.get('key1')).toBeNull();
      expect(store.get('key2')).toBeNull();
    });
  });

  describe('HISTORY Strategy', () => {
    beforeEach(() => {
      store = new DataStore('test:history', StorageStrategy.HISTORY);
    });

    it('should set and get data from history.state', () => {
      store.set('key1', 'value1');
      expect(store.get('key1')).toBe('value1');

      // 数据应该在 history.state 中
      expect(window.history.state?.['test:history']).toBeTruthy();
    });

    it('should clear data from history.state', () => {
      store.set('key1', 'value1');
      expect(store.get('key1')).toBe('value1');

      store.clear();
      expect(store.get('key1')).toBeNull();
    });
  });

  describe('Namespace isolation', () => {
    it('should isolate data between different namespaces', () => {
      const store1 = new DataStore('namespace1', StorageStrategy.MEMORY);
      const store2 = new DataStore('namespace2', StorageStrategy.MEMORY);

      store1.set('key', 'value1');
      store2.set('key', 'value2');

      expect(store1.get('key')).toBe('value1');
      expect(store2.get('key')).toBe('value2');

      store1.destroy();
      store2.destroy();
    });

    it('should throw error when creating store with existing namespace', () => {
      const store1 = new DataStore('namespace', StorageStrategy.MEMORY);

      expect(() => {
        new DataStore('namespace', StorageStrategy.SESSION);
      }).toThrow('already registered');

      store1.destroy();
    });
  });

  describe('Type safety', () => {
    beforeEach(() => {
      store = new DataStore<{ name: string; age: number }>('test:typed', StorageStrategy.MEMORY);
    });

    it('should support typed data', () => {
      const data = { name: 'Alice', age: 30 };
      store.set('user', data);

      const retrieved = store.get('user');
      expect(retrieved?.name).toBe('Alice');
      expect(retrieved?.age).toBe(30);
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      store = new DataStore('test:edge', StorageStrategy.MEMORY);
    });

    it('should handle empty strings', () => {
      store.set('empty', '');
      expect(store.get('empty')).toBe('');
    });

    it('should handle zero', () => {
      store.set('zero', 0);
      expect(store.get('zero')).toBe(0);
    });

    it('should handle false', () => {
      store.set('false', false);
      expect(store.get('false')).toBe(false);
    });

    it('should handle empty arrays', () => {
      store.set('emptyArray', []);
      expect(store.get('emptyArray')).toEqual([]);
    });

    it('should handle empty objects', () => {
      store.set('emptyObj', {});
      expect(store.get('emptyObj')).toEqual({});
    });

    it('should handle very large objects', () => {
      const largeData = {
        items: Array(1000).fill(0).map((_, i) => ({ id: i, value: `item-${i}` }))
      };
      store.set('large', largeData);
      const retrieved = store.get('large');
      expect(retrieved?.items.length).toBe(1000);
    });
  });
});
