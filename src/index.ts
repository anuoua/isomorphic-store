// Types and Interfaces
export {
  StorageStrategy,
  DataStoreEventType,
  // the following are types/interfaces
  type DataWithVersion,
  type MigrationRule,
  type DataStoreOptions,
  type DataStoreEvent,
  type EventListener,
  type Unsubscribe,
  type IStorageAdapter
} from './types';

// Errors
export {
  DataStoreError,
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
} from './adapters';

// Factory
export { StorageAdapterFactory } from './factory';

// Main Class
export { DataStore } from './data-store';

// Registry
export { globalNamespaceRegistry } from './registry';
