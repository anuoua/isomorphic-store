# DataStore

## 1. 介绍

DataStore 是一个轻量级且灵活的 TypeScript 存储库，为浏览器环境提供一致的数据存储 API。无论后端使用 localStorage、sessionStorage、history 状态、navigation 状态还是内存，都可以通过统一接口访问，无需重写业务逻辑。

核心特性：

- **多适配器支持** — 开箱即用的5种存储策略，可快速切换存储后端。
- **命名空间隔离** — 防止不同模块或应用数据冲突。
- **事件系统** — 订阅数据变化，实时响应。
- **版本管理与迁移** — 数据升级时自动转换，无需手写兼容代码。
- **全面的错误处理** — 自定义错误类，方便调试。
- **TypeScript 原生** — 完整的类型支持。

---

## 2. 安装

使用包管理器安装：

```bash
npm install data-store
```

或：

```bash
pnpm add data-store
yarn add data-store
```

---

## 3. 使用

### 3.1 基础示例

创建一个简单的存储并执行 CRUD 操作：

```ts
import { DataStore, StorageStrategy } from 'data-store';

// 创建内存存储
const store = new DataStore('my-app:state', StorageStrategy.MEMORY);

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

### 3.2 存储策略

DataStore 提供5种内置存储策略，可根据需求选择：

#### 3.2.1 LOCAL (localStorage)

数据持久化，关闭浏览器后仍保留。用于长期配置和用户偏好。

```ts
const settings = new DataStore('settings', StorageStrategy.LOCAL);
settings.set('theme', 'dark');
// 刷新页面后数据仍存在
```

#### 3.2.2 SESSION (sessionStorage)

会话级持久化，标签页关闭时清除。用于会话范围的临时数据。

```ts
const session = new DataStore('session', StorageStrategy.SESSION);
session.set('authToken', 'abc123');
```

#### 3.2.3 MEMORY

内存存储，进程结束后清除。用于仅需应用运行期间的临时状态。

```ts
const cache = new DataStore('cache', StorageStrategy.MEMORY);
cache.set('cachedList', [1, 2, 3]);
```

#### 3.2.4 HISTORY (history.state)

使用浏览器历史 API，与路由集成。用于流程中间状态。

```ts
const flow = new DataStore('flow', StorageStrategy.HISTORY);
flow.set('currentStep', 2);
```

#### 3.2.5 NAVIGATION (navigation.state)

异步导航 API，用于跨标签页导航上下文。

```ts
const nav = new DataStore('nav', StorageStrategy.NAVIGATION);
nav.set('destination', '/home');
```

### 3.3 事件订阅

监听数据变化，实现实时响应：

```ts
const store = new DataStore('app', StorageStrategy.MEMORY);

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

### 3.4 版本与迁移

数据结构升级时，自动迁移已有数据无需手动转换：

```ts
// 版本 1 的数据
const storeV1 = new DataStore('user', StorageStrategy.LOCAL, { version: 1 });
storeV1.set('profile', { name: 'Alice', age: 25 });
storeV1.destroy();

// 升级到版本 2，定义迁移规则
const storeV2 = new DataStore('user', StorageStrategy.LOCAL, {
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
const store = new DataStore('data', StorageStrategy.LOCAL, {
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

### 3.5 命名空间

每个 DataStore 实例通过命名空间隔离数据，防止冲突：

```ts
// 用户模块
const userStore = new DataStore('user:profile', StorageStrategy.LOCAL);
userStore.set('name', 'Alice');

// 设置模块
const settingsStore = new DataStore('app:settings', StorageStrategy.LOCAL);
settingsStore.set('theme', 'dark');

// 各自独立，不互相影响
console.log(userStore.get('name')); // 'Alice'
console.log(settingsStore.get('theme')); // 'dark'
console.log(userStore.get('theme')); // null
```

### 3.6 自定义适配器

扩展存储能力，注册自定义适配器：

```ts
import { globalNamespaceRegistry } from 'data-store';

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
const db = new DataStore('myapp', 'indexeddb');
```

---

## 4. API 参考

### DataStore 类

#### 构造函数

```ts
constructor(
  namespace: string,
  strategy: StorageStrategy | string,
  options?: DataStoreOptions<T>
)
```

- `namespace`（string）：命名空间标识，相同命名空间共享数据。
- `strategy`（StorageStrategy | string）：存储策略或自定义适配器名称。
- `options`（DataStoreOptions）：
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
interface DataStoreEvent<T> {
  type: DataStoreEventType;      // 'set' | 'remove' | 'clear'
  key?: string;                   // 操作的键名
  oldValue?: T | null | undefined; // 旧值
  newValue?: T | null | undefined; // 新值
  namespace: string;              // 命名空间
  timestamp: number;              // 事件发生时间戳（毫秒）
  source: DataStore<T>;          // 事件来源（DataStore 实例）
}
```

### 错误类型

```ts
// 基础错误类
class DataStoreError extends Error { }

// 命名空间冲突错误
class NamespaceConflictError extends DataStoreError { }

// 迁移错误
class MigrationError extends DataStoreError { }

// 适配器错误
class AdapterError extends DataStoreError { }

// 未初始化错误
class NotInitializedError extends DataStoreError { }

// 无效参数错误
class InvalidArgumentError extends DataStoreError { }
```

使用示例：

```ts
import { MigrationError } from 'data-store';

try {
  const store = new DataStore('app', StorageStrategy.LOCAL, {
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
  DataStore,
  StorageStrategy,
  DataStoreEvent,
  DataStoreEventType,
  DataStoreOptions,
  MigrationRule,
  EventListener,
  Unsubscribe,
  IStorageAdapter,
  globalNamespaceRegistry
} from 'data-store';
```

---

## 5. 证书

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

更多信息和示例，请访问 [GitHub 仓库](https://github.com/anuoua/data-store)。