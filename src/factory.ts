import { StorageStrategy, type IStorageAdapter } from './types';
import {
  LocalStorageAdapter,
  SessionStorageAdapter,
  MemoryStorageAdapter,
  HistoryStateAdapter,
  NavigationStateAdapter
} from './adapters';
import { UnsupportedStrategyError } from './errors';

/**
 * 存储适配器工厂类
 */
export class StorageAdapterFactory {
  static create<T = unknown>(strategy: StorageStrategy, namespace: string): IStorageAdapter<T> {
    switch (strategy) {
      case StorageStrategy.LOCAL:
        return new LocalStorageAdapter<T>(namespace);

      case StorageStrategy.SESSION:
        return new SessionStorageAdapter<T>(namespace);

      case StorageStrategy.MEMORY:
        return new MemoryStorageAdapter<T>();

      case StorageStrategy.HISTORY:
        return new HistoryStateAdapter<T>(namespace);

      case StorageStrategy.NAVIGATION:
        // 尝试创建 NavigationStateAdapter，如果不支持则降级到 HistoryStateAdapter
        if (typeof window !== 'undefined' && 'navigation' in window) {
          return new NavigationStateAdapter<T>(namespace);
        } else {
          return new HistoryStateAdapter<T>(namespace);
        }

      default:
        throw new UnsupportedStrategyError(String(strategy));
    }
  }
}
