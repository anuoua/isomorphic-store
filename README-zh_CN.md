# IsomorphicStore

## 1. 介绍

IsomorphicStore 是一个轻量级且灵活的 TypeScript 存储库，为浏览器环境提供一致的数据存储 API。无论后端使用 localStorage、sessionStorage、history 状态、navigation 状态还是内存，都可以通过统一接口访问，无需重写业务逻辑。

核心特性：

- **多适配器支持** — 开箱即用的5种存储策略，可快速切换存储后端。
- **命名空间隔离** — 防止不同模块或应用数据冲突。
- **事件系统** — 订阅数据变化，实时响应。
- **版本管理与迁移** — 数据升级时自动转换，无需手写兼容代码。
- **全面的错误处理** — 自定义错误类，方便调试。
- **TypeScript 原生** — 完整的类型支持。

---

## 2. 核心概念

### 存储策略

IsomorphicStore 支持以下五种存储策略，各代表不同的生命周期：

| 策略           | 存储位置                        | 生命周期               | 容量     | 用途                         |
| -------------- | ------------------------------- | ---------------------- | -------- | ---------------------------- |
| **LOCAL**      | `localStorage`                  | 跨会话、跨标签页持久化 | 5-10MB   | 用户偏好、设置、长期缓存     |
| **SESSION**    | `sessionStorage`                | 当前标签页会话期间     | 5-10MB   | 临时会话数据、临时状态       |
| **MEMORY**     | 内存堆                          | 页面运行期间           | 无限制   | 计算缓存、性能优化、临时数据 |
| **HISTORY**    | `history.state`                 | 当前历史记录条目       | 同源限制 | 页面内导航状态、表单恢复     |
| **NAVIGATION** | `navigation.currentEntry.state` | 当前导航条目（新 API） | 同源限制 | 新式 Web App 导航状态        |

### 核心原则

1. **策略绑定**：每个 `IsomorphicStore` 实例在构造时指定一个策略，此后该实例的所有操作都使用此策略。
2. **命名空间隔离**：每个 `IsomorphicStore` 占有独立的命名空间，防止不同模块或应用数据冲突。
3. **冲突检测**：同一命名空间不能被多个 `IsomorphicStore` 占用，否则抛出错误。
4. **跨存储协调**：若业务需要跨不同存储策略操作，由用户创建多个 `IsomorphicStore` 实例并手动协调。
5. **自动初始化**：构造时自动初始化存储位置，确保数据结构完整。

---

## 3. 安装

使用包管理器安装：

```bash
npm install isomorphic-store
```

或：

```bash
pnpm add isomorphic-store
yarn add isomorphic-store
```

---

## 4. 使用

### 4.1 基础示例

定义 Schema，创建存储，执行 CRUD 操作：

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

### 4.2 存储策略

IsomorphicStore 提供5种内置存储策略，可根据需求选择：

#### 4.2.1 LOCAL (localStorage)

数据持久化，关闭浏览器后仍保留。用于长期配置和用户偏好。

```ts
type SettingsSchema = { theme: string };
const settings = new IsomorphicStore<SettingsSchema>('settings', StorageStrategy.LOCAL);
settings.set('theme', 'dark');
```

#### 4.2.2 SESSION (sessionStorage)

会话级持久化，标签页关闭时清除。用于会话范围的临时数据。

```ts
type SessionSchema = { authToken: string };
const session = new IsomorphicStore<SessionSchema>('session', StorageStrategy.SESSION);
session.set('authToken', 'abc123');
```

#### 4.2.3 MEMORY

内存存储，进程结束后清除。用于仅需应用运行期间的临时状态。

```ts
type CacheSchema = { cachedList: number[] };
const cache = new IsomorphicStore<CacheSchema>('cache', StorageStrategy.MEMORY);
cache.set('cachedList', [1, 2, 3]);
```

#### 4.2.4 HISTORY (history.state)

使用浏览器历史 API，与路由集成。用于流程中间状态。

```ts
type FlowSchema = { currentStep: number };
const flow = new IsomorphicStore<FlowSchema>('flow', StorageStrategy.HISTORY);
flow.set('currentStep', 2);
```

#### 4.2.5 NAVIGATION (navigation.state)

异步导航 API，用于跨标签页导航上下文。

```ts
type NavSchema = { destination: string };
const nav = new IsomorphicStore<NavSchema>('nav', StorageStrategy.NAVIGATION);
nav.set('destination', '/home');
```

### 4.3 事件订阅

监听数据变化，实现实时响应：

```ts
type AppSchema = { count: number };
const store = new IsomorphicStore<AppSchema>('app', StorageStrategy.MEMORY);

// 订阅所有变化
const unsubscribe = store.on(event => {
  console.log(`事件: ${event.type}`);
  console.log(`键: ${event.key}`);
  console.log(`旧值: ${event.oldValue}`);
  console.log(`新值: ${event.newValue}`);
});

store.set('count', 1); // 触发订阅

// 监听特定 key
const unsubKey = store.onKey('count', event => {
  console.log(`count 变为 ${event.newValue}`);
});

unsubscribe();
unsubKey();
```

### 4.4 版本与迁移

数据结构升级时，自动迁移已有数据：

```ts
type UserSchema = {
  profile: { name: string; age: number; joinedAt?: number };
};

// 版本 1 的数据
const storeV1 = new IsomorphicStore<UserSchema>('user', StorageStrategy.LOCAL, { version: 1 });
storeV1.set('profile', { name: 'Alice', age: 25 });
storeV1.destroy();

// 升级到版本 2，定义迁移规则
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

### 4.5 命名空间

每个 IsomorphicStore 实例通过命名空间隔离数据，防止冲突：

```ts
type UserSchema = { name: string };
type SettingsSchema = { theme: string };

const userStore = new IsomorphicStore<UserSchema>('user:profile', StorageStrategy.LOCAL);
const settingsStore = new IsomorphicStore<SettingsSchema>('app:settings', StorageStrategy.LOCAL);

userStore.set('name', 'Alice');
settingsStore.set('theme', 'dark');

console.log(userStore.get('name'));   // 'Alice'
console.log(settingsStore.get('theme')); // 'dark'
console.log(userStore.get('theme'));  // null — 不同命名空间
```

### 4.6 TypeScript 使用说明

`IsomorphicStore<T>` 要求 `T` 是一个 Record 类型，将 key 映射到对应的值类型（即 Schema）。TypeScript 会为每个 key 推断精确类型：

```ts
type AppSchema = {
  user: { id: number; name: string };
  theme: 'light' | 'dark';
  isLoggedIn: boolean;
};

const store = new IsomorphicStore<AppSchema>('app', StorageStrategy.LOCAL);

store.set('user', { id: 1, name: 'Alice' }); // 类型安全
store.set('theme', 'dark');                   // 类型安全
// store.set('theme', 'invalid');             // 编译错误

const user = store.get('user'); // { id: number; name: string } | null

// key 名也会被类型检查
store.remove('theme');    // OK
// store.remove('unknown'); // 编译错误
```

动态 key 场景使用索引签名：

```ts
type DynamicSchema = { [key: string]: unknown };
const store = new IsomorphicStore<DynamicSchema>('dynamic', StorageStrategy.MEMORY);
```

---

## 5. API 参考

### IsomorphicStore 类

```ts
class IsomorphicStore<T extends Record<string, any>>
```

#### 构造函数

```ts
constructor(
  namespace: string,
  strategy: StorageStrategy | string,
  options?: IsomorphicStoreOptions
)
```

- `namespace`（string）：命名空间标识，相同命名空间共享数据。
- `strategy`（StorageStrategy | string）：存储策略或自定义适配器名称。
- `options`：
  - `version`（number）：数据版本，默认为 1。
  - `migrations`（MigrationRule[]）：版本迁移规则。

#### 方法

**set\<K extends keyof T & string\>(key: K, value: T[K]): void**

设置或更新数据项。key 和 value 的类型从 Schema 自动推断。

**get\<K extends keyof T & string\>(key: K): T[K] | null**

获取数据项，如需要则执行版本迁移。

**remove\<K extends keyof T & string\>(key: K): void**

删除指定数据项。

**clear(): void**

清除命名空间内所有数据。

**hasKey\<K extends keyof T & string\>(key: K): boolean**

检查数据项是否存在。

**getOrDefault\<K extends keyof T & string\>(key: K, defaultValue: T[K]): T[K]**

获取数据项，不存在时返回 `defaultValue`。

**on(listener: EventListener): Unsubscribe**

订阅所有数据变化事件。

**off(listener: EventListener): void**

取消订阅所有数据变化事件。

**onKey\<K extends keyof T & string\>(key: K, listener: EventListener\<T[K]\>): Unsubscribe**

订阅特定 key 的变化事件。

**offKey\<K extends keyof T & string\>(key: K, listener: EventListener\<T[K]\>): void**

取消订阅特定 key 的变化事件。

**once(listener: EventListener): Unsubscribe**

订阅下一次数据变化事件（触发后自动取消）。

**onceKey\<K extends keyof T & string\>(key: K, listener: EventListener\<T[K]\>): Unsubscribe**

订阅特定 key 的下一次变化事件。

**destroy(): void**

销毁存储实例，卸载所有监听器。

### 事件对象

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

### 错误类型

```ts
class IsomorphicStoreError extends Error { }
class NamespaceConflictError extends IsomorphicStoreError { }
class MigrationError extends IsomorphicStoreError { }
class SerializationError extends IsomorphicStoreError { }
class StorageQuotaExceededError extends IsomorphicStoreError { }
class UnsupportedStrategyError extends IsomorphicStoreError { }
```

### 导出的类型

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

## 6. 许可证

MIT License

Copyright (c) 2025

本项目采用 MIT 许可证，允许自由使用、修改和分发。详见 [LICENSE](LICENSE) 文件。

---

更多信息和示例，请访问 [GitHub 仓库](https://github.com/anuoua/isomorphic-store)。
