import { type IStorageAdapter, type IsomorphicStoreEvent } from '../types';
import { SerializationError, StorageQuotaExceededError } from '../errors';

/**
 * localStorage 适配器
 */
export class LocalStorageAdapter<T = unknown> implements IStorageAdapter<T> {
  private namespace: string;
  private externalChangeCallback?: (event: IsomorphicStoreEvent<T>) => void;

  constructor(namespace: string) {
    this.namespace = namespace;

    // 监听其他标签页的 storage 事件
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key && this.externalChangeCallback) {
          const prefix = `${this.namespace}:`;
          if (!event.key.startsWith(prefix)) return;

          const rawKey = event.key.slice(prefix.length);
          this.externalChangeCallback({
            type: 'set' as any,
            key: rawKey,
            newValue: event.newValue ? JSON.parse(event.newValue) : undefined,
            oldValue: event.oldValue ? JSON.parse(event.oldValue) : undefined,
            namespace: this.namespace,
            timestamp: Date.now(),
            source: this
          });
        }
      });
    }
  }

  private getStorageKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  get(key: string): T | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const value = window.localStorage.getItem(this.getStorageKey(key));
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  set(key: string, value: T): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      window.localStorage.setItem(this.getStorageKey(key), serialized);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new StorageQuotaExceededError('', 'localStorage');
      }
      throw new SerializationError(key, (error as Error).message);
    }
  }

  remove(key: string): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(this.getStorageKey(key));
  }

  clear(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const prefix = `${this.namespace}:`;
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      window.localStorage.removeItem(k);
    }
  }

  hasKey(key: string): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(this.getStorageKey(key)) !== null;
  }

  setExternalChangeCallback(callback: (event: IsomorphicStoreEvent<T>) => void): void {
    this.externalChangeCallback = callback;
  }
}
