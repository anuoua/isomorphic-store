# IsomorphicStore [中文](./README-zh_CN.md)

## 1. Introduction

IsomorphicStore is a lightweight and flexible TypeScript storage library that provides a consistent data storage API for browser environments. Regardless of whether the underlying storage mechanism is localStorage, sessionStorage, history state, navigation state, or in-memory storage, you can access data through a unified interface without modifying business logic.

Key Features:

- **Multiple Adapter Support** — Five built-in storage strategies available out of the box for quick backend switching.
- **Namespace Isolation** — Prevents data conflicts between different modules or applications.
- **Event System** — Subscribe to data changes and respond in real-time.
- **Version Management and Migration** — Automatically transforms data during upgrades without manual compatibility code.
- **Comprehensive Error Handling** — Custom error classes for convenient debugging.
- **Native TypeScript Support** — Complete type safety.

---

## 2. Installation

Install using your preferred package manager:

```bash
npm install isomorphic-store
```

Or:

```bash
pnpm add isomorphic-store
yarn add isomorphic-store
```

---

## 3. Usage

### 3.1 Basic Example

Create a simple store and perform basic CRUD operations:

```ts
import { IsomorphicStore, StorageStrategy } from 'isomorphic-store';

// Create an in-memory store
const store = new IsomorphicStore('my-app:state', StorageStrategy.MEMORY);

// Set data
store.set('username', 'Alice');
store.set('theme', 'dark');

// Read data
console.log(store.get('username')); // 'Alice'

// Remove a single item
store.remove('theme');

// Clear all data
store.clear();

// Destroy the store instance
store.destroy();
```

### 3.2 Storage Strategies

IsomorphicStore provides five built-in storage strategies. Choose based on your requirements:

#### 3.2.1 LOCAL (localStorage)

Data persists across browser sessions. Suitable for long-term configurations and user preferences.

```ts
const settings = new IsomorphicStore('settings', StorageStrategy.LOCAL);
settings.set('theme', 'dark');
// Data remains after browser reload
```

#### 3.2.2 SESSION (sessionStorage)

Session-scoped persistence. Data is cleared when the tab closes. Suitable for session-level temporary data.

```ts
const session = new IsomorphicStore('session', StorageStrategy.SESSION);
session.set('authToken', 'abc123');
```

#### 3.2.3 MEMORY

In-memory storage cleared when the process terminates. Suitable for application runtime-only temporary state.

```ts
const cache = new IsomorphicStore('cache', StorageStrategy.MEMORY);
cache.set('cachedList', [1, 2, 3]);
```

#### 3.2.4 HISTORY (history.state)

Uses the browser History API, integrated with routing. Suitable for intermediate workflow states.

```ts
const flow = new IsomorphicStore('flow', StorageStrategy.HISTORY);
flow.set('currentStep', 2);
```

#### 3.2.5 NAVIGATION (navigation.state)

Asynchronous Navigation API for cross-tab navigation context.

```ts
const nav = new IsomorphicStore('nav', StorageStrategy.NAVIGATION);
nav.set('destination', '/home');
```

### 3.3 Event Subscription

Monitor data changes and respond in real-time:

```ts
const store = new IsomorphicStore('app', StorageStrategy.MEMORY);

// Subscribe to all changes
const unsubscribe = store.subscribe(event => {
  console.log(`Event: ${event.type}`);
  console.log(`Key: ${event.key}`);
  console.log(`Old Value: ${event.oldValue}`);
  console.log(`New Value: ${event.newValue}`);
  console.log(`Timestamp: ${event.timestamp}`);
});

store.set('count', 1); // Trigger subscription
// Output: Event: set, Key: count, New Value: 1

// Unsubscribe
unsubscribe();
```

### 3.4 Versioning and Migration

Automatically migrate existing data when the data structure is upgraded—no manual transformation required:

```ts
// Version 1 data
const storeV1 = new IsomorphicStore('user', StorageStrategy.LOCAL, { version: 1 });
storeV1.set('profile', { name: 'Alice', age: 25 });
storeV1.destroy();

// Upgrade to version 2 with migration rules
const storeV2 = new IsomorphicStore('user', StorageStrategy.LOCAL, {
  version: 2,
  migrations: [
    {
      from: 1,
      to: 2,
      migrate: (data) => ({
        name: data.name,
        age: data.age,
        joinedAt: Date.now() // New field
      })
    }
  ]
});

// Data is automatically migrated on read
const profile = storeV2.get('profile');
console.log(profile); // { name: 'Alice', age: 25, joinedAt: 1709... }
```

Multi-level migration:

```ts
const store = new IsomorphicStore('data', StorageStrategy.LOCAL, {
  version: 3,
  migrations: [
    {
      from: 1,
      to: 2,
      migrate: data => ({ ...data, v2: true })
    },
    {
      from: 2,
      to: 3,
      migrate: data => ({ ...data, timestamp: Date.now() })
    }
  ]
});
```

### 3.5 Namespacing

Each IsomorphicStore instance isolates data through namespaces, preventing conflicts:

```ts
// User module
const userStore = new IsomorphicStore('user:profile', StorageStrategy.LOCAL);
userStore.set('name', 'Alice');

// Settings module
const settingsStore = new IsomorphicStore('app:settings', StorageStrategy.LOCAL);
settingsStore.set('theme', 'dark');

// Each operates independently
console.log(userStore.get('name')); // 'Alice'
console.log(settingsStore.get('theme')); // 'dark'
console.log(userStore.get('theme')); // null
```

### 3.6 Custom Adapters

Extend storage capabilities by registering custom adapters:

```ts
import { globalNamespaceRegistry } from 'isomorphic-store';

class IndexedDBAdapter {
  get(key) { /* implementation */ }
  set(key, value) { /* implementation */ }
  remove(key) { /* implementation */ }
  clear() { /* implementation */ }
  hasKey(key) { /* implementation */ }
}

// Register custom adapter
globalNamespaceRegistry.register('indexeddb', new IndexedDBAdapter());

// Use it
const db = new IsomorphicStore('myapp', 'indexeddb');
```

---

## 4. API Reference

### IsomorphicStore Class

#### Constructor

```ts
constructor(
  namespace: string,
  strategy: StorageStrategy | string,
  options?: IsomorphicStoreOptions<T>
)
```

- `namespace` (string): Namespace identifier. Stores with the same namespace share data.
- `strategy` (StorageStrategy | string): Storage strategy or custom adapter name.
- `options` (IsomorphicStoreOptions):
  - `version` (number): Data version, defaults to 1.
  - `migrations` (MigrationRule[]): Version migration rules.

#### Methods

**set(key: string, value: T): void**

Sets or updates a data item.

```ts
store.set('key', 'value');
```

**get(key: string): T | null**

Retrieves a data item. Executes version migration if needed.

```ts
const value = store.get('key');
```

**remove(key: string): void**

Removes a specific data item.

```ts
store.remove('key');
```

**clear(): void**

Clears all data within the namespace.

```ts
store.clear();
```

**hasKey(key: string): boolean**

Checks if a data item exists.

```ts
if (store.hasKey('key')) {
  // ...
}
```

**subscribe(listener: EventListener<T>): Unsubscribe**

Subscribes to data change events. Returns an unsubscribe function.

```ts
const unsubscribe = store.subscribe(event => {
  console.log(event);
});

unsubscribe();
```

**destroy(): void**

Destroys the store instance and unloads all listeners.

```ts
store.destroy();
```

### Event Object

```ts
interface IsomorphicStoreEvent<T> {
  type: IsomorphicStoreEventType;        // 'set' | 'remove' | 'clear'
  key?: string;                     // Key being operated on
  oldValue?: T | null | undefined;  // Previous value
  newValue?: T | null | undefined;  // New value
  namespace: string;                // Namespace
  timestamp: number;                // Event timestamp in milliseconds
  source: IsomorphicStore<T>;            // Event source (IsomorphicStore instance)
}
```

### Error Types

```ts
// Base error class
class IsomorphicStoreError extends Error { }

// Namespace conflict error
class NamespaceConflictError extends IsomorphicStoreError { }

// Migration error
class MigrationError extends IsomorphicStoreError { }

// Adapter error
class AdapterError extends IsomorphicStoreError { }

// Not initialized error
class NotInitializedError extends IsomorphicStoreError { }

// Invalid argument error
class InvalidArgumentError extends IsomorphicStoreError { }
```

Usage example:

```ts
import { MigrationError } from 'isomorphic-store';

try {
  const store = new IsomorphicStore('app', StorageStrategy.LOCAL, {
    version: 3,
    migrations: [
      { from: 1, to: 2, migrate: d => d }
      // Missing migration rule for 2->3
    ]
  });
  store.get('data'); // Throws MigrationError
} catch (err) {
  if (err instanceof MigrationError) {
    console.error('Migration failed:', err.message);
  }
}
```

### Exported Types

```ts
import {
  IsomorphicStore,
  StorageStrategy,
  IsomorphicStoreEvent,
  IsomorphicStoreEventType,
  IsomorphicStoreOptions,
  MigrationRule,
  EventListener,
  Unsubscribe,
  IStorageAdapter,
  globalNamespaceRegistry
} from 'isomorphic-store';
```

---

## 5. License

MIT License

Copyright (c) 2025

This project is licensed under the MIT License, allowing free use, modification, and distribution. See the [LICENSE](LICENSE) file for details.

---

## Core Mechanisms Summary

| Mechanism | Description | Use Case |
|-----------|-------------|----------|
| Storage Strategy | Five available built-in storage backends | Select persistent or temporary storage based on requirements |
| Namespace | Data isolation and organization | Prevent data conflicts in multi-module applications |
| Event System | Subscribe to data changes | Real-time UI updates or trigger business logic |
| Migration Mechanism | Automatic data upgrade and transformation | Maintain data compatibility during application evolution |
| Error Handling | Custom error classes | Precisely capture and locate issues |

---

For more information and examples, visit the [GitHub repository](https://github.com/anuoua/isomorphic-store).