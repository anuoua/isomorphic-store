import { type IStorageAdapter, type DataStoreEvent } from '../types';
import { SerializationError, StorageQuotaExceededError } from '../errors';

/**
 * sessionStorage 适配器
 */
export class SessionStorageAdapter<T = unknown> implements IStorageAdapter<T> {
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
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }

    try {
      const value = window.sessionStorage.getItem(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  set(key: string, value: T): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      window.sessionStorage.setItem(key, serialized);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new StorageQuotaExceededError('', 'sessionStorage');
      }
      throw new SerializationError(key, (error as Error).message);
    }
  }

  remove(key: string): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }
    window.sessionStorage.removeItem(key);
  }

  clear(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }
    window.sessionStorage.clear();
  }

  hasKey(key: string): boolean {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }
    return window.sessionStorage.getItem(key) !== null;
  }

  setExternalChangeCallback(callback: (event: DataStoreEvent<T>) => void): void {
    this.externalChangeCallback = callback;
  }
}
