import { type IStorageAdapter, type DataStoreEvent } from '../types';
import { SerializationError, StorageQuotaExceededError } from '../errors';

/**
 * localStorage 适配器
 */
export class LocalStorageAdapter<T = unknown> implements IStorageAdapter<T> {
  private externalChangeCallback?: (event: DataStoreEvent<T>) => void;

  constructor() {
    // 监听其他标签页的 storage 事件
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key && this.externalChangeCallback) {
          this.externalChangeCallback({
            type: 'set' as any,
            key: event.key,
            newValue: event.newValue ? JSON.parse(event.newValue) : undefined,
            oldValue: event.oldValue ? JSON.parse(event.oldValue) : undefined,
            namespace: '',
            timestamp: Date.now(),
            source: this
          });
        }
      });
    }
  }

  get(key: string): T | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const value = window.localStorage.getItem(key);
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
      window.localStorage.setItem(key, serialized);
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
    window.localStorage.removeItem(key);
  }

  clear(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.clear();
  }

  hasKey(key: string): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(key) !== null;
  }

  setExternalChangeCallback(callback: (event: DataStoreEvent<T>) => void): void {
    this.externalChangeCallback = callback;
  }
}
