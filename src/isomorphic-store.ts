import {
  StorageStrategy,
  IsomorphicStoreEventType,
  type IsomorphicStoreEvent,
  type EventListener,
  type Unsubscribe,
  type IsomorphicStoreOptions,
  type IStorageAdapter
} from './types';
import { globalNamespaceRegistry } from './registry';
import { StorageAdapterFactory } from './factory';
import { MigrationError } from './errors';

const VERSION_KEY = '__version__';

type SchemaKey<T> = keyof T & string;
type SchemaValue<T, K extends string> = T extends Record<K, infer V> ? V : never;

export class IsomorphicStore<T extends Record<string, any> = Record<string, any>> {
  private namespace: string;
  private adapter: IStorageAdapter<T[keyof T]>;
  private currentVersion: number;
  private migrations: Map<string, (data: Record<string, any>) => Record<string, any>>;
  private globalListeners = new Set<EventListener<T[keyof T]>>();
  private keyListeners = new Map<string, Set<EventListener<any>>>();
  private onceListeners = new Set<EventListener<T[keyof T]>>();
  private onceKeyListeners = new Map<string, Set<EventListener<any>>>();

  constructor(
    namespace: string,
    strategy: StorageStrategy,
    options?: IsomorphicStoreOptions<T[keyof T]>
  ) {
    this.namespace = namespace;
    this.currentVersion = options?.version ?? 1;

    globalNamespaceRegistry.register(namespace, strategy);

    this.adapter = StorageAdapterFactory.create<T[keyof T]>(strategy, namespace);

    if (this.adapter.setExternalChangeCallback) {
      this.adapter.setExternalChangeCallback((event: IsomorphicStoreEvent<T[keyof T]>) => {
        this.handleExternalChange(event);
      });
    }

    this.migrations = new Map();
    if (options?.migrations) {
      for (const rule of options.migrations) {
        const key = `${rule.from}->${rule.to}`;
        this.migrations.set(key, rule.migrate);
      }
    }

    this.migrateIfNeeded();
  }

  private migrateIfNeeded(): void {
    const hasStoredVersion = this.adapter.hasKey(VERSION_KEY);
    const storedVersion = this.getStoredVersion();

    if (storedVersion >= this.currentVersion) {
      return;
    }

    const allKeys = this.adapter.getAllKeys().filter(k => k !== VERSION_KEY);

    if (!hasStoredVersion && allKeys.length === 0) {
      this.setStoredVersion(this.currentVersion);
      return;
    }

    const allData: Record<string, any> = {};

    for (const key of allKeys) {
      const value = this.adapter.get(key);
      if (value !== null) {
        allData[key] = value;
      }
    }

    const migratedData = this.migrateData(allData, storedVersion);

    for (const [key, value] of Object.entries(migratedData)) {
      this.adapter.set(key, value as T[keyof T]);
    }

    for (const key of allKeys) {
      if (!(key in migratedData)) {
        this.adapter.remove(key);
      }
    }

    this.setStoredVersion(this.currentVersion);
  }

  private getStoredVersion(): number {
    const version = this.adapter.get(VERSION_KEY);
    if (version === null) {
      return 1;
    }
    return version as unknown as number;
  }

  private setStoredVersion(version: number): void {
    this.adapter.set(VERSION_KEY, version as unknown as T[keyof T]);
  }

  private handleExternalChange(event: IsomorphicStoreEvent<T[keyof T]>): void {
    if (!event.key) {
      return;
    }

    this.emitEvent({
      type: event.type as IsomorphicStoreEventType,
      key: event.key,
      oldValue: event.oldValue,
      newValue: event.newValue,
      namespace: this.namespace,
      timestamp: Date.now(),
      source: this
    });
  }

  private emitEvent(event: IsomorphicStoreEvent<any>): void {
    for (const listener of this.globalListeners) {
      listener(event);
    }

    if (event.key && this.keyListeners.has(event.key)) {
      for (const listener of this.keyListeners.get(event.key)!) {
        listener(event);
      }
    }

    const onceToRemove: EventListener<any>[] = [];
    for (const listener of this.onceListeners) {
      listener(event);
      onceToRemove.push(listener);
    }
    for (const l of onceToRemove) this.onceListeners.delete(l);

    if (event.key && this.onceKeyListeners.has(event.key)) {
      const keyOnce = this.onceKeyListeners.get(event.key)!;
      const keyOnceToRemove: EventListener<any>[] = [];
      for (const listener of keyOnce) {
        listener(event);
        keyOnceToRemove.push(listener);
      }
      for (const l of keyOnceToRemove) keyOnce.delete(l);
      if (keyOnce.size === 0) this.onceKeyListeners.delete(event.key);
    }
  }

  private migrateData(data: Record<string, any>, fromVersion: number): Record<string, any> {
    if (fromVersion >= this.currentVersion) {
      return data;
    }

    let currentData = data;
    let currentVersion = fromVersion;

    while (currentVersion < this.currentVersion) {
      const nextVersion = currentVersion + 1;
      const migrationKey = `${currentVersion}->${nextVersion}`;

      if (!this.migrations.has(migrationKey)) {
        throw new MigrationError(currentVersion, nextVersion);
      }

      currentData = this.migrations.get(migrationKey)!(currentData);
      currentVersion = nextVersion;
    }

    return currentData;
  }

  set<K extends SchemaKey<T>>(key: K, value: SchemaValue<T, K>): void {
    const oldValue = this.get(key);

    this.adapter.set(key, value as T[keyof T]);

    this.emitEvent({
      type: IsomorphicStoreEventType.SET,
      key,
      oldValue,
      newValue: value,
      namespace: this.namespace,
      timestamp: Date.now(),
      source: this
    });
  }

  get<K extends SchemaKey<T>>(key: K): SchemaValue<T, K> | null {
    return this.adapter.get(key) as SchemaValue<T, K> | null;
  }

  remove<K extends SchemaKey<T>>(key: K): void {
    const oldValue = this.get(key);

    this.adapter.remove(key);

    this.emitEvent({
      type: IsomorphicStoreEventType.REMOVE,
      key,
      oldValue,
      namespace: this.namespace,
      timestamp: Date.now(),
      source: this
    });
  }

  clear(): void {
    this.adapter.clear();

    this.emitEvent({
      type: IsomorphicStoreEventType.CLEAR,
      namespace: this.namespace,
      timestamp: Date.now(),
      source: this
    });
  }

  hasKey<K extends SchemaKey<T>>(key: K): boolean {
    return this.adapter.hasKey(key);
  }

  getOrDefault<K extends SchemaKey<T>>(
    key: K,
    defaultValue: SchemaValue<T, K>
  ): SchemaValue<T, K> {
    const value = this.get(key);
    return (value !== null ? value : defaultValue) as any;
  }

  on(listener: EventListener<T[keyof T]>): Unsubscribe {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  off(listener: EventListener<T[keyof T]>): void {
    this.globalListeners.delete(listener);
  }

  onKey<K extends SchemaKey<T>>(
    key: K,
    listener: EventListener<SchemaValue<T, K>>
  ): Unsubscribe {
    if (!this.keyListeners.has(key)) {
      this.keyListeners.set(key, new Set());
    }
    this.keyListeners.get(key)!.add(listener);

    return () => {
      const listeners = this.keyListeners.get(key);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.keyListeners.delete(key);
        }
      }
    };
  }

  offKey<K extends SchemaKey<T>>(
    key: K,
    listener: EventListener<SchemaValue<T, K>>
  ): void {
    const listeners = this.keyListeners.get(key);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.keyListeners.delete(key);
      }
    }
  }

  once(listener: EventListener<T[keyof T]>): Unsubscribe {
    this.onceListeners.add(listener);
    return () => {
      this.onceListeners.delete(listener);
    };
  }

  onceKey<K extends SchemaKey<T>>(
    key: K,
    listener: EventListener<SchemaValue<T, K>>
  ): Unsubscribe {
    if (!this.onceKeyListeners.has(key)) {
      this.onceKeyListeners.set(key, new Set());
    }
    this.onceKeyListeners.get(key)!.add(listener);

    return () => {
      const listeners = this.onceKeyListeners.get(key);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.onceKeyListeners.delete(key);
        }
      }
    };
  }

  destroy(): void {
    this.globalListeners.clear();
    this.keyListeners.clear();
    this.onceListeners.clear();
    this.onceKeyListeners.clear();

    globalNamespaceRegistry.unregister(this.namespace);
  }
}
