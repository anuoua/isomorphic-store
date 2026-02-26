import {
  StorageStrategy,
  DataStoreEventType,
  type DataStoreEvent,
  type EventListener,
  type Unsubscribe,
  type DataStoreOptions,
  type DataWithVersion,
  type IStorageAdapter
} from './types';
import { globalNamespaceRegistry } from './registry';
import { StorageAdapterFactory } from './factory';
import { MigrationError } from './errors';

/**
 * DataStore 主类
 * 提供类型安全的浏览器数据存储
 */
export class DataStore<T = unknown> {
  private namespace: string;
  private strategy: StorageStrategy;
  private adapter: IStorageAdapter<DataWithVersion<T>>;
  private currentVersion: number;
  private migrations: Map<string, (data: unknown) => T>;
  private globalListeners = new Set<EventListener<T>>();
  private keyListeners = new Map<string, Set<EventListener<T>>>();
  private onceListeners = new Set<EventListener<T>>();
  private onceKeyListeners = new Map<string, Set<EventListener<T>>>();

  constructor(
    namespace: string,
    strategy: StorageStrategy,
    options?: DataStoreOptions<T>
  ) {
    this.namespace = namespace;
    this.strategy = strategy;
    this.currentVersion = options?.version ?? 1;

    // 注册命名空间
    globalNamespaceRegistry.register(namespace, strategy);

    // 创建适配器
    this.adapter = StorageAdapterFactory.create<DataWithVersion<T>>(strategy, namespace);

    // 设置外部变化回调
    if (this.adapter.setExternalChangeCallback) {
      this.adapter.setExternalChangeCallback((event) => {
        this.handleExternalChange(event);
      });
    }

    // 构建迁移映射
    this.migrations = new Map();
    if (options?.migrations) {
      for (const rule of options.migrations) {
        const key = `${rule.from}->${rule.to}`;
        this.migrations.set(key, rule.migrate);
      }
    }
  }

  /**
   * 处理外部变化事件
   */
  private handleExternalChange(event: DataStoreEvent<DataWithVersion<T>>): void {
    if (!event.key) {
      return;
    }

    // 发出事件
    this.emitEvent({
      type: event.type as DataStoreEventType,
      key: event.key,
      oldValue: event.oldValue?.data,
      newValue: event.newValue?.data,
      namespace: this.namespace,
      timestamp: Date.now(),
      source: this
    });
  }

  /**
   * 发出事件
   */
  private emitEvent(event: DataStoreEvent<T>): void {
    // 发出全局事件
    for (const listener of this.globalListeners) {
      listener(event);
    }

    // 发出 key 监听事件
    if (event.key && this.keyListeners.has(event.key)) {
      for (const listener of this.keyListeners.get(event.key)!) {
        listener(event);
      }
    }

    // 发出一次性全局事件
    const onceListenersToRemove = [];
    for (const listener of this.onceListeners) {
      listener(event);
      onceListenersToRemove.push(listener);
    }
    onceListenersToRemove.forEach((listener) => this.onceListeners.delete(listener));

    // 发出一次性 key 事件
    if (event.key && this.onceKeyListeners.has(event.key)) {
      const keyOnceListeners = this.onceKeyListeners.get(event.key)!;
      const keyOnceListenersToRemove = [];
      for (const listener of keyOnceListeners) {
        listener(event);
        keyOnceListenersToRemove.push(listener);
      }
      keyOnceListenersToRemove.forEach((listener) => keyOnceListeners.delete(listener));

      if (keyOnceListeners.size === 0) {
        this.onceKeyListeners.delete(event.key);
      }
    }
  }

  /**
   * 获取存储的完整 key（包括命名空间前缀）
   */
  private getStorageKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * 执行版本迁移
   */
  private migrateData(data: DataWithVersion<unknown>): T {
    if (data.version >= this.currentVersion) {
      return data.data as T;
    }

    let currentData: unknown = data.data;
    let currentVersion = data.version;

    // 执行迁移链
    while (currentVersion < this.currentVersion) {
      const nextVersion = currentVersion + 1;
      const migrationKey = `${currentVersion}->${nextVersion}`;

      if (!this.migrations.has(migrationKey)) {
        throw new MigrationError('', currentVersion, nextVersion);
      }

      const migrationFn = this.migrations.get(migrationKey)!;
      currentData = migrationFn(currentData);
      currentVersion = nextVersion;
    }

    return currentData as T;
  }

  /**
   * 设置数据
   */
  set(key: string, value: T): void {
    const storageKey = this.getStorageKey(key);
    const oldValue = this.get(key);

    const wrappedValue: DataWithVersion<T> = {
      version: this.currentVersion,
      data: value
    };

    this.adapter.set(storageKey, wrappedValue);

    // 发出 SET 事件
    this.emitEvent({
      type: DataStoreEventType.SET,
      key,
      oldValue,
      newValue: value,
      namespace: this.namespace,
      timestamp: Date.now(),
      source: this
    });
  }

  /**
   * 获取数据
   */
  get(key: string): T | null {
    const storageKey = this.getStorageKey(key);
    const wrappedValue = this.adapter.get(storageKey);

    if (wrappedValue === null) {
      return null;
    }

    // 检查并执行版本迁移
    if (wrappedValue.version < this.currentVersion) {
      const migratedValue = this.migrateData(wrappedValue);
      // 直接写回到适配器，不通过 set() 方法以避免递归
      const migratedWrapped: DataWithVersion<T> = {
        version: this.currentVersion,
        data: migratedValue
      };
      this.adapter.set(storageKey, migratedWrapped);
      return migratedValue;
    }

    return wrappedValue.data;
  }

  /**
   * 删除数据
   */
  remove(key: string): void {
    const storageKey = this.getStorageKey(key);
    const oldValue = this.get(key);

    this.adapter.remove(storageKey);

    // 发出 REMOVE 事件
    this.emitEvent({
      type: DataStoreEventType.REMOVE,
      key,
      oldValue,
      namespace: this.namespace,
      timestamp: Date.now(),
      source: this
    });
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    // 获取所有存储的 key 并删除
    const namespace = this.namespace;
    const keysToRemove = [];

    // 需要遍历所有可能的 key，但我们没有直接的方式获取所有 key
    // 这里我们只清空我们知道的 key
    // 对于完整的清空，我们会直接清空 adapter（但这会影响其他数据）
    // 解决方案：只清空这个命名空间的数据

    // 对于内存适配器，我们可以直接清空
    if (this.strategy === StorageStrategy.MEMORY) {
      this.adapter.clear();
    } else if (this.strategy === StorageStrategy.LOCAL) {
      // 对于 localStorage，我们需要遍历所有 key
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToDelete = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(`${namespace}:`)) {
            keysToDelete.push(key);
          }
        }
        for (const key of keysToDelete) {
          window.localStorage.removeItem(key);
        }
      }
    } else if (this.strategy === StorageStrategy.SESSION) {
      // 对于 sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const keysToDelete = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key && key.startsWith(`${namespace}:`)) {
            keysToDelete.push(key);
          }
        }
        for (const key of keysToDelete) {
          window.sessionStorage.removeItem(key);
        }
      }
    } else {
      // 对于 HISTORY 和 NAVIGATION，直接调用 adapter.clear()
      this.adapter.clear();
    }

    // 发出 CLEAR 事件
    this.emitEvent({
      type: DataStoreEventType.CLEAR,
      namespace: this.namespace,
      timestamp: Date.now(),
      source: this
    });
  }

  /**
   * 检查 key 是否存在
   */
  hasKey(key: string): boolean {
    const storageKey = this.getStorageKey(key);
    return this.adapter.hasKey(storageKey);
  }

  /**
   * 获取数据或返回默认值
   */
  getOrDefault(key: string, defaultValue: T): T {
    const value = this.get(key);
    return value !== null ? value : defaultValue;
  }

  /**
   * 监听所有数据变化
   */
  on(listener: EventListener<T>): Unsubscribe {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * 取消监听所有数据变化
   */
  off(listener: EventListener<T>): void {
    this.globalListeners.delete(listener);
  }

  /**
   * 监听特定 key 的变化
   */
  onKey(key: string, listener: EventListener<T>): Unsubscribe {
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

  /**
   * 取消监听特定 key 的变化
   */
  offKey(key: string, listener: EventListener<T>): void {
    const listeners = this.keyListeners.get(key);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.keyListeners.delete(key);
      }
    }
  }

  /**
   * 一次性监听所有数据变化
   */
  once(listener: EventListener<T>): Unsubscribe {
    this.onceListeners.add(listener);
    return () => {
      this.onceListeners.delete(listener);
    };
  }

  /**
   * 一次性监听特定 key 的变化
   */
  onceKey(key: string, listener: EventListener<T>): Unsubscribe {
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

  /**
   * 销毁 DataStore 实例
   */
  destroy(): void {
    // 清空所有监听器
    this.globalListeners.clear();
    this.keyListeners.clear();
    this.onceListeners.clear();
    this.onceKeyListeners.clear();

    // 注销命名空间
    globalNamespaceRegistry.unregister(this.namespace);
  }
}
