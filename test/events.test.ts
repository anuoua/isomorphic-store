/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IsomorphicStore, StorageStrategy, IsomorphicStoreEventType, globalNamespaceRegistry } from '../src';

describe('IsomorphicStore - Event System', () => {
  let store: IsomorphicStore<any>;

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
    store = new IsomorphicStore('test:events', StorageStrategy.MEMORY);
  });

  afterEach(() => {
    if (store) {
      store.destroy();
    }
  });

  describe('Global listeners', () => {
    it('should trigger on global listener on SET', () => {
      return new Promise<void>((resolve) => {
        const listener = vi.fn((event) => {
          expect(event.type).toBe(IsomorphicStoreEventType.SET);
          expect(event.key).toBe('key1');
          expect(event.newValue).toBe('value1');
          expect(event.namespace).toBe('test:events');
          expect(event.source).toBe(store);
          resolve();
        });

        store.on(listener);
        store.set('key1', 'value1');
      });
    });

    it('should trigger on global listener on REMOVE', () => {
      return new Promise<void>((resolve) => {
        store.set('key1', 'value1');

        const listener = vi.fn((event) => {
          expect(event.type).toBe(IsomorphicStoreEventType.REMOVE);
          expect(event.key).toBe('key1');
          expect(event.oldValue).toBe('value1');
          resolve();
        });

        store.on(listener);
        store.remove('key1');
      });
    });

    it('should trigger on global listener on CLEAR', () => {
      return new Promise<void>((resolve) => {
        store.set('key1', 'value1');

        const listener = vi.fn((event) => {
          expect(event.type).toBe(IsomorphicStoreEventType.CLEAR);
          expect(event.key).toBeUndefined();
          resolve();
        });

        store.on(listener);
        store.clear();
      });
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = store.on(listener);

      store.set('key1', 'value1');
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      store.set('key2', 'value2');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support off method', () => {
      const listener = vi.fn();
      store.on(listener);

      store.set('key1', 'value1');
      expect(listener).toHaveBeenCalledTimes(1);

      store.off(listener);
      store.set('key2', 'value2');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      store.on(listener1);
      store.on(listener2);

      store.set('key1', 'value1');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Key-specific listeners', () => {
    it('should only trigger for specific key', () => {
      const listener = vi.fn();
      store.onKey('key1', listener);

      store.set('key1', 'value1');
      expect(listener).toHaveBeenCalledTimes(1);

      store.set('key2', 'value2');
      expect(listener).toHaveBeenCalledTimes(1);

      store.set('key1', 'value1-updated');
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should return unsubscribe function for key listeners', () => {
      const listener = vi.fn();
      const unsub = store.onKey('key1', listener);

      store.set('key1', 'value1');
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      store.set('key1', 'value1-updated');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support offKey method', () => {
      const listener = vi.fn();
      store.onKey('key1', listener);

      store.set('key1', 'value1');
      expect(listener).toHaveBeenCalledTimes(1);

      store.offKey('key1', listener);
      store.set('key1', 'value1-updated');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple key listeners for same key', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      store.onKey('key1', listener1);
      store.onKey('key1', listener2);

      store.set('key1', 'value1');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should trigger on REMOVE event for key listener', () => {
      const listener = vi.fn();
      store.set('key1', 'value1');

      store.onKey('key1', listener);
      store.remove('key1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].type).toBe(IsomorphicStoreEventType.REMOVE);
    });
  });

  describe('Once listeners', () => {
    it('should trigger only once for global listener', () => {
      const listener = vi.fn();
      store.once(listener);

      store.set('key1', 'value1');
      expect(listener).toHaveBeenCalledTimes(1);

      store.set('key2', 'value2');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function for once listeners', () => {
      const listener = vi.fn();
      const unsub = store.once(listener);

      unsub();
      store.set('key1', 'value1');
      expect(listener).toHaveBeenCalledTimes(0);
    });

    it('should trigger only once for key listener', () => {
      const listener = vi.fn();
      store.onceKey('key1', listener);

      store.set('key1', 'value1');
      expect(listener).toHaveBeenCalledTimes(1);

      store.set('key1', 'value1-updated');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function for onceKey listeners', () => {
      const listener = vi.fn();
      const unsub = store.onceKey('key1', listener);

      unsub();
      store.set('key1', 'value1');
      expect(listener).toHaveBeenCalledTimes(0);
    });

    it('should support multiple once listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      store.once(listener1);
      store.once(listener2);

      store.set('key1', 'value1');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      store.set('key2', 'value2');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event timestamp and source', () => {
    it('should include timestamp in event', () => {
      return new Promise<void>((resolve) => {
        const listener = (event: any) => {
          expect(event.timestamp).toBeDefined();
          expect(typeof event.timestamp).toBe('number');
          expect(event.timestamp > 0).toBe(true);
          resolve();
        };

        store.on(listener);
        store.set('key1', 'value1');
      });
    });

    it('should include source in event', () => {
      return new Promise<void>((resolve) => {
        const listener = (event: any) => {
          expect(event.source).toBe(store);
          resolve();
        };

        store.on(listener);
        store.set('key1', 'value1');
      });
    });
  });

  describe('Event ordering', () => {
    it('should trigger listeners in order', () => {
      const calls: number[] = [];
      const listener1 = () => calls.push(1);
      const listener2 = () => calls.push(2);
      const listener3 = () => calls.push(3);

      store.on(listener1);
      store.on(listener2);
      store.on(listener3);

      store.set('key1', 'value1');

      expect(calls).toEqual([1, 2, 3]);
    });

    it('should not affect other listeners when one unsubscribes', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      const unsub2 = store.on(listener1);
      store.on(listener2);
      store.on(listener3);

      store.set('key1', 'value1');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      unsub2();

      store.set('key2', 'value2');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(2);
      expect(listener3).toHaveBeenCalledTimes(2);
    });
  });

  describe('Combined listeners', () => {
    it('should trigger both global and key-specific listeners', () => {
      const globalListener = vi.fn();
      const keyListener = vi.fn();

      store.on(globalListener);
      store.onKey('key1', keyListener);

      store.set('key1', 'value1');

      expect(globalListener).toHaveBeenCalledTimes(1);
      expect(keyListener).toHaveBeenCalledTimes(1);
    });

    it('should trigger different key listeners independently', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      store.onKey('key1', listener1);
      store.onKey('key2', listener2);

      store.set('key1', 'value1');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(0);

      store.set('key2', 'value2');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event with old and new values', () => {
    it('should include oldValue and newValue on SET', () => {
      return new Promise<void>((resolve) => {
        const listener = (event: any) => {
          expect(event.oldValue).toBeNull();
          expect(event.newValue).toBe('value1');
          resolve();
        };

        store.on(listener);
        store.set('key1', 'value1');
      });
    });

    it('should include oldValue on UPDATE', () => {
      return new Promise<void>((resolve) => {
        store.set('key1', 'value1');

        const listener = (event: any) => {
          expect(event.oldValue).toBe('value1');
          expect(event.newValue).toBe('value2');
          resolve();
        };

        store.on(listener);
        store.set('key1', 'value2');
      });
    });

    it('should include oldValue on REMOVE', () => {
      return new Promise<void>((resolve) => {
        store.set('key1', 'value1');

        const listener = (event: any) => {
          expect(event.oldValue).toBe('value1');
          expect(event.newValue).toBeUndefined();
          resolve();
        };

        store.on(listener);
        store.remove('key1');
      });
    });
  });
});
