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

创建一个简单的存储并执行 CRUD 操作：

```ts
import { IsomorphicStore, StorageStrategy } from 'isomorphic-store';

// 创建内存存储
const store = new IsomorphicStore('my-app:state', StorageStrategy.MEMORY);

// 设置数据
store.set('username', 'Alice');
store.set('theme', 'dark');

// 读取数据
console.log(store.get('username')); // 'Alice'

// 移除单个数据
store.remove('theme');

// 清空所有数据
store.clear();

// 销毁存储实例
store.destroy();
```

### 4.2 存储策略

IsomorphicStore 提供5种内置存储策略，可根据需求选择：

#### 4.2.1 LOCAL (localStorage)

数据持久化，关闭浏览器后仍保留。用于长期配置和用户偏好。

```ts
const settings = new IsomorphicStore('settings', StorageStrategy.LOCAL);
settings.set('theme', 'dark');
// 刷新页面后数据仍存在
```

#### 4.2.2 SESSION (sessionStorage)

会话级持久化，标签页关闭时清除。用于会话范围的临时数据。

```ts
const session = new IsomorphicStore('session', StorageStrategy.SESSION);
session.set('authToken', 'abc123');
```

#### 4.2.3 MEMORY

内存存储，进程结束后清除。用于仅需应用运行期间的临时状态。

```ts
const cache = new IsomorphicStore('cache', StorageStrategy.MEMORY);
cache.set('cachedList', [1, 2, 3]);
```

#### 4.2.4 HISTORY (history.state)

使用浏览器历史 API，与路由集成。用于流程中间状态。

```ts
const flow = new IsomorphicStore('flow', StorageStrategy.HISTORY);
flow.set('currentStep', 2);
```

#### 4.2.5 NAVIGATION (navigation.state)

异步导航 API，用于跨标签页导航上下文。

```ts
const nav = new IsomorphicStore('nav', StorageStrategy.NAVIGATION);
nav.set('destination', '/home');
```

### 4.3 事件订阅

监听数据变化，实现实时响应：

```ts
const store = new IsomorphicStore('app', StorageStrategy.MEMORY);

// 订阅所有变化
const unsubscribe = store.subscribe(event => {
  console.log(`事件: ${event.type}`);
  console.log(`键: ${event.key}`);
  console.log(`旧值: ${event.oldValue}`);
  console.log(`新值: ${event.newValue}`);
  console.log(`时间戳: ${event.timestamp}`);
});

store.set('count', 1); // 触发订阅
// 输出: 事件: set, 键: count, 新值: 1

// 取消订阅
unsubscribe();
```

### 4.4 版本与迁移

数据结构升级时，自动迁移已有数据无需手动转换：

```ts
// 版本 1 的数据
const storeV1 = new IsomorphicStore('user', StorageStrategy.LOCAL, { version: 1 });
storeV1.set('profile', { name: 'Alice', age: 25 });
storeV1.destroy();

// 升级到版本 2，定义迁移规则
const storeV2 = new IsomorphicStore('user', StorageStrategy.LOCAL, {
  version: 2,
  migrations: [
    {
      from: 1,
      to: 2,
      migrate: (data) => ({
        name: data.name,
        age: data.age,
        joinedAt: Date.now() // 新增字段
      })
    }
  ]
});

// 读取时自动执行迁移
const profile = storeV2.get('profile');
console.log(profile); // { name: 'Alice', age: 25, joinedAt: 1709... }
```

多级迁移：

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

### 4.5 命名空间

每个 IsomorphicStore 实例通过命名空间隔离数据，防止冲突：

```ts
// 用户模块
const userStore = new IsomorphicStore('user:profile', StorageStrategy.LOCAL);
userStore.set('name', 'Alice');

// 设置模块
const settingsStore = new IsomorphicStore('app:settings', StorageStrategy.LOCAL);
settingsStore.set('theme', 'dark');

// 各自独立，不互相影响
console.log(userStore.get('name')); // 'Alice'
console.log(settingsStore.get('theme')); // 'dark'
console.log(userStore.get('theme')); // null
```

### 4.6 自定义适配器

扩展存储能力，注册自定义适配器：

```ts
import { globalNamespaceRegistry } from 'isomorphic-store';

class IndexedDBAdapter {
  get(key) { /* 实现 */ }
  set(key, value) { /* 实现 */ }
  remove(key) { /* 实现 */ }
  clear() { /* 实现 */ }
  hasKey(key) { /* 实现 */ }
}

// 注册自定义适配器
globalNamespaceRegistry.register('indexeddb', new IndexedDBAdapter());

// 使用
const db = new IsomorphicStore('myapp', 'indexeddb');
```

### 4.7 Typescript 使用说明

IsomorphicStore 在类型层面支持两种使用方式：

- Schema 模式（每个 key 指定独立类型，推荐）：在创建 `IsomorphicStore` 时传入一个映射 key -> 类型 的泛型对象，TypeScript 会为每个 key 推断精确的类型。
- 单一类型模式（所有 key 共享同一类型，向后兼容）：继续传入单个类型 `T`，此时所有 key 的值都必须符合 `T`。

示例 — Schema 模式：

```ts
type AppSchema = {
  user: { id: number; name: string };
  theme: 'light' | 'dark';
  isLoggedIn: boolean;
};

const store = new IsomorphicStore<AppSchema>('app', StorageStrategy.LOCAL);

store.set('user', { id: 1, name: 'Alice' }); // ✅ 类型安全
store.set('theme', 'dark'); // ✅
// store.set('theme', 'invalid'); // ❌ 编译错误

const user = store.get('user'); // { id: number; name: string } | null
```

示例 — 单一类型模式（向后兼容）：

```ts
const store = new IsomorphicStore<string>('strings', StorageStrategy.MEMORY);
store.set('k1', 'value');
const v = store.get('k1'); // string | null
```

迁移建议：

- 如果当前代码使用单一类型但希望迁移到 Schema，请先在类型层面定义好 Schema，然后逐步将 `set`/`get` 调用替换为对应 key 的精确类型。Schema 仅影响编译期类型检查，不会在运行时产生开销。
- 对于动态或未知 key，可保留单一类型（例如 `any` 或 `unknown`），或在 Schema 中使用更通用的条目（如索引签名）。

---

## 5. API 参考

### IsomorphicStore 类

#### 构造函数

```ts
constructor(
  namespace: string,
  strategy: StorageStrategy | string,
  options?: IsomorphicStoreOptions<T>
)
```

- `namespace`（string）：命名空间标识，相同命名空间共享数据。
- `strategy`（StorageStrategy | string）：存储策略或自定义适配器名称。
- `options`（IsomorphicStoreOptions）：
  - `version`（number）：数据版本，默认为 1。
  - `migrations`（MigrationRule[]）：版本迁移规则。

#### 方法

**set(key: string, value: T): void**

设置或更新数据项。

```ts
store.set('key', 'value');
```

**get(key: string): T | null**

获取数据项，如需要则执行版本迁移。

```ts
const value = store.get('key');
```

**remove(key: string): void**

删除指定数据项。

```ts
store.remove('key');
```

**clear(): void**

清除命名空间内所有数据。

```ts
store.clear();
```

**hasKey(key: string): boolean**

检查数据项是否存在。

```ts
if (store.hasKey('key')) {
  // ...
}
```

**subscribe(listener: EventListener<T>): Unsubscribe**

订阅数据变化事件，返回取消订阅函数。

```ts
const unsubscribe = store.subscribe(event => {
  console.log(event);
});

unsubscribe();
```

**destroy(): void**

销毁存储实例，卸载所有监听器。

```ts
store.destroy();
```

### 事件对象

```ts
interface IsomorphicStoreEvent<T> {
  type: IsomorphicStoreEventType;      // 'set' | 'remove' | 'clear'
  key?: string;                   // 操作的键名
  oldValue?: T | null | undefined; // 旧值
  newValue?: T | null | undefined; // 新值
  namespace: string;              // 命名空间
  timestamp: number;              // 事件发生时间戳（毫秒）
  source: IsomorphicStore<T>;          // 事件来源（IsomorphicStore 实例）
}
```

### 错误类型

```ts
// 基础错误类
class IsomorphicStoreError extends Error { }

// 命名空间冲突错误
class NamespaceConflictError extends IsomorphicStoreError { }

// 迁移错误
class MigrationError extends IsomorphicStoreError { }

// 适配器错误
class AdapterError extends IsomorphicStoreError { }

// 未初始化错误
class NotInitializedError extends IsomorphicStoreError { }

// 无效参数错误
class InvalidArgumentError extends IsomorphicStoreError { }
```

使用示例：

```ts
import { MigrationError } from 'isomorphic-store';

try {
  const store = new IsomorphicStore('app', StorageStrategy.LOCAL, {
    version: 3,
    migrations: [
      { from: 1, to: 2, migrate: d => d }
      // 缺少 2->3 的迁移规则
    ]
  });
  store.get('data'); // 抛出 MigrationError
} catch (err) {
  if (err instanceof MigrationError) {
    console.error('迁移失败:', err.message);
  }
}
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

## 6. 证书

MIT License

Copyright (c) 2025

本项目采用 MIT 证书，允许自由使用、修改和分发。详见 [LICENSE](LICENSE) 文件。

---

## 核心机制总结

| 机制 | 说明 | 使用场景 |
|------|------|---------|
| 存储策略 | 开箱即用的5种存储后端 | 根据需求选择持久化或临时存储 |
| 命名空间 | 数据隔离与组织 | 多模块应用中防止数据冲突 |
| 事件系统 | 订阅数据变化 | 实时更新 UI 或触发业务逻辑 |
| 迁移机制 | 自动数据升级转换 | 应用演进过程中维持数据兼容性 |
| 错误处理 | 自定义错误类 | 精准捕获和定位问题 |

---

更多信息和示例，请访问 [GitHub 仓库](https://github.com/anuoua/isomorphic-store)。