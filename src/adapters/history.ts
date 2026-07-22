import { type IStorageAdapter, type IsomorphicStoreEvent } from '../types';
import { SerializationError } from '../errors';

const INTERNAL_EVENT = '__isomorphic_store_change__';

interface InternalChangeDetail {
  instanceId: string;
  namespace: string;
  key: string;
  type: 'set' | 'remove';
  newValue?: string;
}

export class HistoryStateAdapter<T = unknown> implements IStorageAdapter<T> {
  private namespace: string;
  private externalChangeCallback?: (event: IsomorphicStoreEvent<T>) => void;
  private lastState: Record<string, any> = {};
  private instanceId: string;
  private boundInternalHandler: (event: CustomEvent<InternalChangeDetail>) => void;

  constructor(namespace: string) {
    this.namespace = namespace;
    this.instanceId = Math.random().toString(36).slice(2) + Date.now().toString(36);

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
      this.initializeState();

      window.addEventListener('popstate', () => {
        this.detectExternalChanges();
      });

      window.addEventListener(INTERNAL_EVENT, this.boundInternalHandler as EventListener);
    }
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

      try {
        this.dispatchInternal(key, 'set', JSON.stringify(value));
      } catch {
        // ignore serialization errors in event dispatch
      }
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
      this.dispatchInternal(key, 'remove');
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

  getAllKeys(): string[] {
    if (typeof window === 'undefined' || !window.history || !window.history.state) {
      return [];
    }

    const state = window.history.state;
    if (!state[this.namespace]) {
      return [];
    }

    return Object.keys(state[this.namespace]);
  }

  setExternalChangeCallback(callback: (event: IsomorphicStoreEvent<T>) => void): void {
    this.externalChangeCallback = callback;
  }
}
