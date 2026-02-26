// Types and Interfaces
export {
  StorageStrategy,
  IsomorphicStoreEventType,
  // the following are types/interfaces
  type DataWithVersion,
  type MigrationRule,
  type IsomorphicStoreOptions,
  type IsomorphicStoreEvent,
  type EventListener,
  type Unsubscribe,
  type IStorageAdapter
} from './types';

// Errors
export {
  IsomorphicStoreError,
  NamespaceConflictError,
  SerializationError,
  StorageQuotaExceededError,
  UnsupportedStrategyError,
  MigrationError
} from './errors';

// Adapters
export {
  LocalStorageAdapter,
  SessionStorageAdapter,
  MemoryStorageAdapter,
  HistoryStateAdapter,
  NavigationStateAdapter
} from './adapters/index';

// Factory
export { StorageAdapterFactory } from './factory';

// Main Class
export { IsomorphicStore as IsomorphicStore } from './isomorphic-store';

// Registry
export { globalNamespaceRegistry } from './registry';
