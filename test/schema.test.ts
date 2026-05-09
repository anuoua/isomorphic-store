/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IsomorphicStore, StorageStrategy, globalNamespaceRegistry } from '../src';

describe('IsomorphicStore - Schema Type Support', () => {
  afterEach(() => {
    globalNamespaceRegistry.clear();
  });

  describe('Schema with multiple typed keys', () => {
    type AppSchema = {
      'user': { id: number; name: string };
      'theme': 'light' | 'dark';
      'isLoggedIn': boolean;
      'count': number;
    };

    let store: IsomorphicStore<AppSchema>;

    beforeEach(() => {
      store = new IsomorphicStore<AppSchema>('schema-test', StorageStrategy.MEMORY);
    });

    afterEach(() => {
      store.destroy();
    });

    it('should set and get user object with correct type', () => {
      const user = { id: 1, name: 'Alice' };
      store.set('user', user);
      
      const retrieved = store.get('user');
      expect(retrieved).toEqual(user);
      expect(retrieved?.id).toBe(1);
      expect(retrieved?.name).toBe('Alice');
    });

    it('should set and get theme string with correct type', () => {
      store.set('theme', 'dark');
      
      const theme = store.get('theme');
      expect(theme).toBe('dark');
    });

    it('should set and get boolean value', () => {
      store.set('isLoggedIn', true);
      
      const loggedIn = store.get('isLoggedIn');
      expect(loggedIn).toBe(true);
    });

    it('should set and get number value', () => {
      store.set('count', 42);
      
      const count = store.get('count');
      expect(count).toBe(42);
    });

    it('should return null for non-existent values', () => {
      const user = store.get('user');
      expect(user).toBeNull();
    });

    it('should work with getOrDefault for schema keys', () => {
      const theme = store.getOrDefault('theme', 'light');
      expect(theme).toBe('light');

      store.set('theme', 'dark');
      const theme2 = store.getOrDefault('theme', 'light');
      expect(theme2).toBe('dark');
    });

    it('should listen to specific schema key changes', () => {
      let eventCount = 0;
      let lastValue: { id: number; name: string } | null = null;

      store.onKey('user', (event) => {
        eventCount++;
        lastValue = event.newValue as any;
      });

      store.set('user', { id: 1, name: 'Alice' });
      expect(eventCount).toBe(1);
      expect(lastValue!.id).toBe(1);

      store.set('user', { id: 2, name: 'Bob' });
      expect(eventCount).toBe(2);
      expect(lastValue!.id).toBe(2);
    });

    it('should listen to theme changes', () => {
      let lastTheme: 'light' | 'dark' | null = null;

      store.onKey('theme', (event) => {
        lastTheme = event.newValue as any;
      });

      store.set('theme', 'dark');
      expect(lastTheme).toBe('dark');

      store.set('theme', 'light');
      expect(lastTheme).toBe('light');
    });

    it('should support onceKey for schema keys', () => {
      let eventCount = 0;

      store.onceKey('count', () => {
        eventCount++;
      });

      store.set('count', 1);
      expect(eventCount).toBe(1);

      store.set('count', 2);
      expect(eventCount).toBe(1);  // Should not trigger again
    });

    it('should support offKey for schema keys', () => {
      let eventCount = 0;

      const handler = () => {
        eventCount++;
      };

      store.onKey('count', handler as any);
      store.set('count', 1);
      expect(eventCount).toBe(1);

      store.offKey('count', handler as any);
      store.set('count', 2);
      expect(eventCount).toBe(1);  // Should not trigger after offKey
    });

    it('should handle null values in schema', () => {
      type SchemaWithNullable = {
        'user': { id: number } | null;
      };

      const nullableStore = new IsomorphicStore<SchemaWithNullable>(
        'nullable-test',
        StorageStrategy.MEMORY
      );

      nullableStore.set('user', null);
      const user = nullableStore.get('user');
      expect(user).toBeNull();

      nullableStore.set('user', { id: 1 });
      const user2 = nullableStore.get('user');
      expect(user2?.id).toBe(1);

      nullableStore.destroy();
    });
  });

  describe('Schema with complex types', () => {
    type ComplexSchema = {
      'config': {
        database: {
          host: string;
          port: number;
        };
        api: {
          timeout: number;
          retries: number;
        };
      };
      'features': ('darkMode' | 'notifications' | 'analytics')[];
      'metadata': Map<string, any>;
    };

    let store: IsomorphicStore<ComplexSchema>;

    beforeEach(() => {
      store = new IsomorphicStore<ComplexSchema>(
        'complex-test',
        StorageStrategy.MEMORY
      );
    });

    afterEach(() => {
      store.destroy();
    });

    it('should handle nested objects', () => {
      const config = {
        database: { host: 'localhost', port: 5432 },
        api: { timeout: 30000, retries: 3 }
      };

      store.set('config', config);
      const retrieved = store.get('config');
      expect(retrieved?.database.host).toBe('localhost');
      expect(retrieved?.api.timeout).toBe(30000);
    });

    it('should handle arrays of union types', () => {
      const features: ('darkMode' | 'notifications' | 'analytics')[] = [
        'darkMode',
        'notifications'
      ];

      store.set('features', features);
      const retrieved = store.get('features');
      expect(retrieved).toEqual(features);
      expect(retrieved?.length).toBe(2);
    });
  });
});
