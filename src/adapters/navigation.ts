import { type IStorageAdapter, type IsomorphicStoreEvent } from '../types';
import { SerializationError, UnsupportedStrategyError } from '../errors';

/**
 * Navigation State 适配器
 * 使用 Navigation API 的 currentEntry.state 存储数据（新 API）
 */
export class NavigationStateAdapter<T = unknown> implements IStorageAdapter<T> {
  private namespace: string;
  private externalChangeCallback?: (event: IsomorphicStoreEvent<T>) => void;
  private lastState: Record<string, any> = {};

  constructor(namespace: string) {
    this.namespace = namespace;

    if (typeof window !== 'undefined') {
      this.initializeState();

      // 监听 navigate 事件
      if ('navigation' in window) {
        (window as any).navigation.addEventListener('navigate', () => {
          this.detectExternalChanges();
        });
      }
    }
  }

  private initializeState(): void {
    if (typeof window === 'undefined' || !('navigation' in window)) {
      return;
    }

    const navigation = (window as any).navigation;
    if (!navigation.currentEntry) {
      return;
    }

    try {
      let state = navigation.currentEntry.getState?.() || {};

      // 如果 namespace 不存在，创建它
      if (!state[this.namespace]) {
        state[this.namespace] = {};
      }

      // 保存初始状态
      this.lastState = { ...state[this.namespace] };

      // 更新 state
      navigation.currentEntry.setState?.(state);
    } catch {
      // Navigation API 可能不完全支持
    }
  }

  private detectExternalChanges(): void {
    if (typeof window === 'undefined' || !('navigation' in window)) {
      return;
    }

    const navigation = (window as any).navigation;
    if (!navigation.currentEntry) {
      return;
    }

    try {
      const currentState = navigation.currentEntry.getState?.() || {};
      if (!currentState[this.namespace]) {
        return;
      }

      const currentNamespaceState = currentState[this.namespace];

      // 比较状态变化
      for (const key in currentNamespaceState) {
        const newValue = currentNamespaceState[key];
        const oldValue = this.lastState[key];

        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
          if (this.externalChangeCallback) {
            this.externalChangeCallback({
              type: 'set' as any,
              key,
              newValue: newValue as T,
              oldValue: oldValue as T,
              namespace: this.namespace,
              timestamp: Date.now(),
              source: this
            });
          }
        }
      }

      // 检查删除的键
      for (const key in this.lastState) {
        if (!(key in currentNamespaceState)) {
          if (this.externalChangeCallback) {
            this.externalChangeCallback({
              type: 'remove' as any,
              key,
              oldValue: this.lastState[key] as T,
              namespace: this.namespace,
              timestamp: Date.now(),
              source: this
            });
          }
        }
      }

      this.lastState = { ...currentNamespaceState };
    } catch {
      // Navigation API 操作失败
    }
  }

  get(key: string): T | null {
    if (typeof window === 'undefined' || !('navigation' in window)) {
      return null;
    }

    const navigation = (window as any).navigation;
    if (!navigation.currentEntry) {
      return null;
    }

    try {
      const state = navigation.currentEntry.getState?.() || {};
      if (!state[this.namespace] || !(key in state[this.namespace])) {
        return null;
      }

      return state[this.namespace][key] as T;
    } catch {
      return null;
    }
  }

  set(key: string, value: T): void {
    if (typeof window === 'undefined' || !('navigation' in window)) {
      return;
    }

    const navigation = (window as any).navigation;
    if (!navigation.currentEntry) {
      return;
    }

    try {
      const state = navigation.currentEntry.getState?.() || {};
      if (!state[this.namespace]) {
        state[this.namespace] = {};
      }

      state[this.namespace][key] = value;
      navigation.currentEntry.setState?.(state);

      // 更新缓存
      this.lastState[key] = value;
    } catch (error) {
      throw new SerializationError(key, (error as Error).message);
    }
  }

  remove(key: string): void {
    if (typeof window === 'undefined' || !('navigation' in window)) {
      return;
    }

    const navigation = (window as any).navigation;
    if (!navigation.currentEntry) {
      return;
    }

    try {
      const state = navigation.currentEntry.getState?.() || {};
      if (state[this.namespace]) {
        delete state[this.namespace][key];
        navigation.currentEntry.setState?.(state);

        // 更新缓存
        delete this.lastState[key];
      }
    } catch {
      // Navigation API 操作失败
    }
  }

  clear(): void {
    if (typeof window === 'undefined' || !('navigation' in window)) {
      return;
    }

    const navigation = (window as any).navigation;
    if (!navigation.currentEntry) {
      return;
    }

    try {
      const state = navigation.currentEntry.getState?.() || {};
      if (state[this.namespace]) {
        state[this.namespace] = {};
        navigation.currentEntry.setState?.(state);

        // 清空缓存
        this.lastState = {};
      }
    } catch {
      // Navigation API 操作失败
    }
  }

  hasKey(key: string): boolean {
    if (typeof window === 'undefined' || !('navigation' in window)) {
      return false;
    }

    const navigation = (window as any).navigation;
    if (!navigation.currentEntry) {
      return false;
    }

    try {
      const state = navigation.currentEntry.getState?.() || {};
      return !!(state[this.namespace] && key in state[this.namespace]);
    } catch {
      return false;
    }
  }

  getAllKeys(): string[] {
    if (typeof window === 'undefined' || !('navigation' in window)) {
      return [];
    }

    const navigation = (window as any).navigation;
    if (!navigation.currentEntry) {
      return [];
    }

    try {
      const state = navigation.currentEntry.getState?.() || {};
      if (!state[this.namespace]) {
        return [];
      }
      return Object.keys(state[this.namespace]);
    } catch {
      return [];
    }
  }

  setExternalChangeCallback(callback: (event: IsomorphicStoreEvent<T>) => void): void {
    this.externalChangeCallback = callback;
  }
}
