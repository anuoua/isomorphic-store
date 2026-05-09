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

## 2. Core Concepts

### Storage Strategies

IsomorphicStore supports five storage strategies, each representing different lifecycles:

| Strategy       | Storage Location                | Lifecycle              | Capacity | Use Cases                              |
| -------------- | ------------------------------- | ---------------------- | -------- | -------------------------------------- |
| **LOCAL**      | `localStorage`                  | Cross-session, cross-tab persistence | 5-10MB   | User preferences, settings, long-term cache |
| **SESSION**    | `sessionStorage`                | Current tab session    | 5-10MB   | Temporary session data, temporary state |
| **MEMORY**     | Memory heap                     | Page runtime           | Unlimited | Computation cache, performance optimization, temporary data |
| **HISTORY**    | `history.state`                 | Current history entry  | Same-origin limit | Page navigation state, form recovery |
| **NAVIGATION** | `navigation.currentEntry.state` | Current navigation entry (new API) | Same-origin limit | Modern Web App navigation state |

### Core Principles

1. **Strategy Binding**: Each `IsomorphicStore` instance specifies a strategy during construction, and all subsequent operations use this strategy.
2. **Namespace Isolation**: Each `IsomorphicStore` has its own isolated namespace to prevent data conflicts between different modules or applications.
3. **Conflict Detection**: The same namespace cannot be occupied by multiple `IsomorphicStore` instances; otherwise, an error is thrown.
4. **Cross-Storage Coordination**: If your business requires operations across different storage strategies, create multiple `IsomorphicStore` instances and coordinate them manually.
5. **Automatic Initialization**: The storage location is automatically initialized during construction to ensure data structure integrity.

---

## 3. Installation

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

## 4. Usage

### 4.1 Basic Example

Define a schema, create a store, and perform CRUD operations:

```ts
import { IsomorphicStore, StorageStrategy } from 'isomorphic-store';

type AppSchema = {
  username: string;
  theme: 'light' | 'dark';
};

const store = new IsomorphicStore<AppSchema>('my-app:state', StorageStrategy.MEMORY);

store.set('username', 'Alice');
store.set('theme', 'dark');

console.log(store.get('username')); // 'Alice'

store.remove('theme');
store.clear();
store.destroy();
```

### 4.2 Storage Strategies

IsomorphicStore provides five built-in storage strategies. Choose based on your requirements:

#### 4.2.1 LOCAL (localStorage)

Data persists across browser sessions. Suitable for long-term configurations and user preferences.

```ts
type SettingsSchema = { theme: string };
const settings = new IsomorphicStore<SettingsSchema>('settings', StorageStrategy.LOCAL);
settings.set('theme', 'dark');
```

#### 4.2.2 SESSION (sessionStorage)

Session-scoped persistence. Data is cleared when the tab closes. Suitable for session-level temporary data.

```ts
type SessionSchema = { authToken: string };
const session = new IsomorphicStore<SessionSchema>('session', StorageStrategy.SESSION);
session.set('authToken', 'abc123');
```

#### 4.2.3 MEMORY

In-memory storage cleared when the process terminates. Suitable for application runtime-only temporary state.

```ts
type CacheSchema = { cachedList: number[] };
const cache = new IsomorphicStore<CacheSchema>('cache', StorageStrategy.MEMORY);
cache.set('cachedList', [1, 2, 3]);
```

#### 4.2.4 HISTORY (history.state)

Uses the browser History API, integrated with routing. Suitable for intermediate workflow states.

```ts
type FlowSchema = { currentStep: number };
const flow = new IsomorphicStore<FlowSchema>('flow', StorageStrategy.HISTORY);
flow.set('currentStep', 2);
```

#### 4.2.5 NAVIGATION (navigation.state)

Asynchronous Navigation API for cross-tab navigation context.

```ts
type NavSchema = { destination: string };
const nav = new IsomorphicStore<NavSchema>('nav', StorageStrategy.NAVIGATION);
nav.set('destination', '/home');
```

### 4.3 Event Subscription

Monitor data changes and respond in real-time:

```ts
type AppSchema = { count: number };
const store = new IsomorphicStore<AppSchema>('app', StorageStrategy.MEMORY);

// Subscribe to all changes
const unsubscribe = store.on(event => {
  console.log(`Event: ${event.type}`);
  console.log(`Key: ${event.key}`);
  console.log(`Old Value: ${event.oldValue}`);
  console.log(`New Value: ${event.newValue}`);
});

store.set('count', 1); // Triggers subscription

// Subscribe to a specific key
const unsubKey = store.onKey('count', event => {
  console.log(`Count changed to ${event.newValue}`);
});

unsubscribe();
unsubKey();
```

### 4.4 Versioning and Migration

Automatically migrate existing data when the data structure is upgraded:

```ts
type UserSchema = {
  profile: { name: string; age: number; joinedAt?: number };
};

// Version 1 data
const storeV1 = new IsomorphicStore<UserSchema>('user', StorageStrategy.LOCAL, { version: 1 });
storeV1.set('profile', { name: 'Alice', age: 25 });
storeV1.destroy();

// Upgrade to version 2 with migration rules
const storeV2 = new IsomorphicStore<UserSchema>('user', StorageStrategy.LOCAL, {
  version: 2,
  migrations: [
    {
      from: 1,
      to: 2,
      migrate: (data) => ({
        name: data.name,
        age: data.age,
        joinedAt: Date.now()
      })
    }
  ]
});

const profile = storeV2.get('profile');
console.log(profile); // { name: 'Alice', age: 25, joinedAt: 1709... }
```

### 4.5 Namespacing

Each IsomorphicStore instance isolates data through namespaces, preventing conflicts:

```ts
type UserSchema = { name: string };
type SettingsSchema = { theme: string };

const userStore = new IsomorphicStore<UserSchema>('user:profile', StorageStrategy.LOCAL);
const settingsStore = new IsomorphicStore<SettingsSchema>('app:settings', StorageStrategy.LOCAL);

userStore.set('name', 'Alice');
settingsStore.set('theme', 'dark');

console.log(userStore.get('name'));   // 'Alice'
console.log(settingsStore.get('theme')); // 'dark'
console.log(userStore.get('theme'));  // null — different namespace
```

### 4.6 TypeScript Usage

`IsomorphicStore<T>` requires `T` to be a record type mapping keys to their value types (a "schema"). TypeScript infers exact types per key:

```ts
type AppSchema = {
  user: { id: number; name: string };
  theme: 'light' | 'dark';
  isLoggedIn: boolean;
};

const store = new IsomorphicStore<AppSchema>('app', StorageStrategy.LOCAL);

store.set('user', { id: 1, name: 'Alice' }); // type-safe
store.set('theme', 'dark');                   // type-safe
// store.set('theme', 'invalid');             // compile error

const user = store.get('user'); // { id: number; name: string } | null

// Key names are also type-checked
store.remove('theme');    // OK
// store.remove('unknown'); // compile error
```

For dynamic keys, use an index signature:

```ts
type DynamicSchema = { [key: string]: unknown };
const store = new IsomorphicStore<DynamicSchema>('dynamic', StorageStrategy.MEMORY);
```

---

## 5. API Reference

### IsomorphicStore Class

```ts
class IsomorphicStore<T extends Record<string, any>>
```

#### Constructor

```ts
constructor(
  namespace: string,
  strategy: StorageStrategy | string,
  options?: IsomorphicStoreOptions
)
```

- `namespace` (string): Namespace identifier. Stores with the same namespace share data.
- `strategy` (StorageStrategy | string): Storage strategy or custom adapter name.
- `options`:
  - `version` (number): Data version, defaults to 1.
  - `migrations` (MigrationRule[]): Version migration rules.

#### Methods

**set\<K extends keyof T & string\>(key: K, value: T[K]): void**

Sets or updates a data item. The key and value types are inferred from the schema.

**get\<K extends keyof T & string\>(key: K): T[K] | null**

Retrieves a data item. Executes version migration if needed.

**remove\<K extends keyof T & string\>(key: K): void**

Removes a specific data item.

**clear(): void**

Clears all data within the namespace.

**hasKey\<K extends keyof T & string\>(key: K): boolean**

Checks if a data item exists.

**getOrDefault\<K extends keyof T & string\>(key: K, defaultValue: T[K]): T[K]**

Gets a data item, returns `defaultValue` if not found.

**on(listener: EventListener): Unsubscribe**

Subscribes to all data change events.

**off(listener: EventListener): void**

Unsubscribes from all data change events.

**onKey\<K extends keyof T & string\>(key: K, listener: EventListener\<T[K]\>): Unsubscribe**

Subscribes to change events for a specific key.

**offKey\<K extends keyof T & string\>(key: K, listener: EventListener\<T[K]\>): void**

Unsubscribes from change events for a specific key.

**once(listener: EventListener): Unsubscribe**

Subscribes to the next data change event only.

**onceKey\<K extends keyof T & string\>(key: K, listener: EventListener\<T[K]\>): Unsubscribe**

Subscribes to the next change event for a specific key only.

**destroy(): void**

Destroys the store instance and unloads all listeners.

### Event Object

```ts
interface IsomorphicStoreEvent<V> {
  type: IsomorphicStoreEventType; // 'set' | 'remove' | 'clear'
  key?: string;
  oldValue?: V | null | undefined;
  newValue?: V | null | undefined;
  namespace: string;
  timestamp: number;
  source: any;
}
```

### Error Types

```ts
class IsomorphicStoreError extends Error { }
class NamespaceConflictError extends IsomorphicStoreError { }
class MigrationError extends IsomorphicStoreError { }
class SerializationError extends IsomorphicStoreError { }
class StorageQuotaExceededError extends IsomorphicStoreError { }
class UnsupportedStrategyError extends IsomorphicStoreError { }
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

## 6. License

MIT License

Copyright (c) 2025

This project is licensed under the MIT License, allowing free use, modification, and distribution. See the [LICENSE](LICENSE) file for details.

---

For more information and examples, visit the [GitHub repository](https://github.com/anuoua/isomorphic-store).
