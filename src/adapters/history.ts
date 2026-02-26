import { type IStorageAdapter, type DataStoreEvent } from '../types';
import { SerializationError } from '../errors';

/**
 * History State 适配器
 * 使用 history.state 存储数据
 */
export class HistoryStateAdapter<T = unknown> implements IStorageAdapter<T> {
  private namespace: string;
  private externalChangeCallback?: (event: DataStoreEvent<T>) => void;
  private lastState: Record<string, any> = {};

  constructor(namespace: string) {
    this.namespace = namespace;

    // 初始化 history.state
    if (typeof window !== 'undefined') {
      this.initializeState();

      // 监听 popstate 事件
      window.addEventListener('popstate', () => {
        this.detectExternalChanges();
      });
    }
  }

  private initializeState(): void {
    if (typeof window === 'undefined' || !window.history) {
      return;
    }

    let state = window.history.state;

    // 如果 state 不存在，创建一个新的
    if (!state) {
      state = {};
    }

    // 如果 namespace 不存在，创建它
    if (!state[this.namespace]) {
      state[this.namespace] = {};
    }

    // 保存初始状态
    this.lastState = { ...state[this.namespace] };

    // 更新 history
    window.history.replaceState(state, '');
  }

  private detectExternalChanges(): void {
    if (typeof window === 'undefined' || !window.history) {
      return;
    }

    const currentState = window.history.state;
    if (!currentState || !currentState[this.namespace]) {
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
  }

  get(key: string): T | null {
    if (typeof window === 'undefined' || !window.history || !window.history.state) {
      return null;
    }

    const state = window.history.state;
    if (!state[this.namespace] || !state[this.namespace][key]) {
      return null;
    }

    return state[this.namespace][key] as T;
  }

  set(key: string, value: T): void {
    if (typeof window === 'undefined' || !window.history) {
      return;
    }

    try {
      const state = window.history.state || {};
      if (!state[this.namespace]) {
        state[this.namespace] = {};
      }

      state[this.namespace][key] = value;
      window.history.replaceState(state, '');

      // 更新缓存
      this.lastState[key] = value;
    } catch (error) {
      throw new SerializationError(key, (error as Error).message);
    }
  }

  remove(key: string): void {
    if (typeof window === 'undefined' || !window.history) {
      return;
    }

    const state = window.history.state || {};
    if (state[this.namespace]) {
      delete state[this.namespace][key];
      window.history.replaceState(state, '');

      // 更新缓存
      delete this.lastState[key];
    }
  }

  clear(): void {
    if (typeof window === 'undefined' || !window.history) {
      return;
    }

    const state = window.history.state || {};
    if (state[this.namespace]) {
      state[this.namespace] = {};
      window.history.replaceState(state, '');

      // 清空缓存
      this.lastState = {};
    }
  }

  hasKey(key: string): boolean {
    if (typeof window === 'undefined' || !window.history || !window.history.state) {
      return false;
    }

    const state = window.history.state;
    return !!(state[this.namespace] && key in state[this.namespace]);
  }

  setExternalChangeCallback(callback: (event: DataStoreEvent<T>) => void): void {
    this.externalChangeCallback = callback;
  }
}
