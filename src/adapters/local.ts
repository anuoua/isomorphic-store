import { type IStorageAdapter, type IsomorphicStoreEvent } from '../types';
import { SerializationError, StorageQuotaExceededError } from '../errors';

const INTERNAL_EVENT = '__isomorphic_store_change__';

interface InternalChangeDetail {
  instanceId: string;
  namespace: string;
  key: string;
  type: 'set' | 'remove';
  newValue?: string;
}

export class LocalStorageAdapter<T = unknown> implements IStorageAdapter<T> {
  private namespace: string;
  private externalChangeCallback?: (event: IsomorphicStoreEvent<T>) => void;
  private instanceId: string;
  private boundStorageHandler: (event: StorageEvent) => void;
  private boundInternalHandler: (event: CustomEvent<InternalChangeDetail>) => void;

  constructor(namespace: string) {
    this.namespace = namespace;
    this.instanceId = Math.random().toString(36).slice(2) + Date.now().toString(36);

    this.boundStorageHandler = (event: StorageEvent) => {
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
    };

    this.boundInternalHandler = (event: CustomEvent<InternalChangeDetail>) => {
      const detail = event.detail;
      if (!detail) return;
      if (detail.instanceId === this.instanceId) return;
      if (detail.namespace !== this.namespace) return;
      if (!this.externalChangeCallback) return;

      this.externalChangeCallback({
        type: detail.type as any,
        key: detail.key,
        newValue: detail.newValue !== undefined ? JSON.parse(detail.newValue) : undefined,
        oldValue: undefined,
        namespace: this.namespace,
        timestamp: Date.now(),
        source: this
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.boundStorageHandler);
      window.addEventListener(INTERNAL_EVENT, this.boundInternalHandler as EventListener);
    }
  }

  private getStorageKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  private dispatchInternal(key: string, type: 'set' | 'remove', newValue?: string): void {
    if (typeof window === 'undefined') return;
    const detail: InternalChangeDetail = {
      instanceId: this.instanceId,
      namespace: this.namespace,
      key,
      type
    };
    if (newValue !== undefined) {
      detail.newValue = newValue;
    }
    window.dispatchEvent(new CustomEvent<InternalChangeDetail>(INTERNAL_EVENT, { detail }));
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
      this.dispatchInternal(key, 'set', serialized);
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
    this.dispatchInternal(key, 'remove');
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

  getAllKeys(): string[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    const prefix = `${this.namespace}:`;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keys.push(k.slice(prefix.length));
      }
    }
    return keys;
  }

  setExternalChangeCallback(callback: (event: IsomorphicStoreEvent<T>) => void): void {
    this.externalChangeCallback = callback;
  }
}
