# IsomorphicStore 设计文档

## 概述

`IsomorphicStore` 是一个浏览器数据存储库，支持多种生命周期的数据存储。用户在创建 `IsomorphicStore` 实例时指定存储策略，之后该实例会自动使用该策略进行所有数据操作。

## 核心概念

### 存储策略

库支持以下五种存储策略，各代表不同的生命周期：

| 策略           | 存储位置                        | 生命周期               | 容量     | 用途                         |
| -------------- | ------------------------------- | ---------------------- | -------- | ---------------------------- |
| **LOCAL**      | `localStorage`                  | 跨会话、跨标签页持久化 | 5-10MB   | 用户偏好、设置、长期缓存     |
| **SESSION**    | `sessionStorage`                | 当前标签页会话期间     | 5-10MB   | 临时会话数据、临时状态       |
| **MEMORY**     | 内存堆                          | 页面运行期间           | 无限制   | 计算缓存、性能优化、临时数据 |
| **HISTORY**    | `history.state`                 | 当前历史记录条目       | 同源限制 | 页面内导航状态、表单恢复     |
| **NAVIGATION** | `navigation.currentEntry.state` | 当前导航条目（新 API） | 同源限制 | 新式 Web App 导航状态        |

### 核心原则

1. **策略绑定**：每个 `IsomorphicStore` 实例在构造时指定一个策略，此后该实例的所有操作都使用此策略。
2. **命名空间隔离**：每个 `IsomorphicStore` 占有独立的命名空间，防止不同模块数据冲突。
3. **冲突检测**：同一命名空间不能被多个 `IsomorphicStore` 占用，否则抛出错误。
4. **跨存储协调**：若业务需要跨不同存储策略操作，由用户创建多个 `IsomorphicStore` 实例并手动协调。
5. **自动初始化**：构造时自动初始化存储位置，确保数据结构完整。

## 数据约束

支持存储的数据类型：

- **基础类型**：`string`, `number`, `boolean`, `null`, `undefined`
- **JSON 兼容类型**：`object`, `array`（需满足 JSON 序列化条件）

不支持存储：

- 函数、Symbol、Proxy 等不可序列化的对象
- 循环引用对象

## 类型模式

`IsomorphicStore` 以泛型参数 `T` 来表示存储数据的类型。为了提供灵活的类型检查，库支持两种模式：

1. **Schema 模式**（推荐）：传入一个映射类型，为每个 key 指定不同的值类型
2. **单一类型模式**（向后兼容）：传入单个类型 `T`，所有 key 的值都符合此类型

## 类设计

### 枚举：`StorageStrategy`

```typescript
enum StorageStrategy {
  LOCAL = "local",
  SESSION = "session",
  MEMORY = "memory",
  HISTORY = "history",
  NAVIGATION = "navigation",
}
```

### 枚举：`IsomorphicStoreEventType`

```typescript
enum IsomorphicStoreEventType {
  SET = "set", // 设置或更新数据
  REMOVE = "remove", // 删除数据
  CLEAR = "clear", // 清空命名空间
}
```

### 接口：`IsomorphicStoreEvent`

```typescript
interface IsomorphicStoreEvent<T = unknown> {
  type: IsomorphicStoreEventType;
  key?: string; // SET/REMOVE 时存在，CLEAR 时无
  oldValue?: T; // SET/REMOVE 时存在
  newValue?: T; // SET 时存在，REMOVE 时为 undefined
  namespace: string; // 命名空间
  timestamp: number; // 事件发生时间戳（毫秒）
  source: IsomorphicStore; // 事件来源
}

type EventListener<T = unknown> = (event: IsomorphicStoreEvent<T>) => void;
type Unsubscribe = () => void;
```

### 接口：`MigrationRule`

```typescript
interface MigrationRule<T = unknown> {
  from: number; // 源版本
  to: number; // 目标版本
  migrate: (data: unknown) => T; // 迁移函数
}
```

### 接口：`DataWithVersion`

```typescript
interface DataWithVersion<T = unknown> {
  version: number; // 数据版本号
  data: T; // 实际数据
}
```

### 接口：`IsomorphicStoreOptions`

```typescript
interface IsomorphicStoreOptions<T = unknown> {
  version?: number; // 当前版本（默认为 1）
  migrations?: MigrationRule<T>[]; // 迁移规则
}
```

### 接口：`IStorageAdapter`

```typescript
interface IStorageAdapter<T = unknown> {
  get(key: string): T | null;
  set(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
  hasKey(key: string): boolean;
  // 可选：Adapter 可注册外部变化回调
  setExternalChangeCallback?(
    callback: (event: IsomorphicStoreEvent<T>) => void,
  ): void;
}
```

### 主类：`IsomorphicStore`

```typescript
class IsomorphicStore<T = unknown> {
  constructor(
    namespace: string,
    strategy: StorageStrategy,
    options?: IsomorphicStoreOptions<T>,
  );

  // 基础操作
  // Schema 模式时，set/get/getOrDefault 会为每个 key 推断精确类型
  set<K extends string>(key: K, value: T extends Record<K, infer V> ? V : T): void;
  get<K extends string>(key: K): T extends Record<K, infer V> ? V | null : T | null;
  remove(key: string): void;
  clear(): void;
  hasKey(key: string): boolean;
  getOrDefault<K extends string>(
    key: K,
    defaultValue: T extends Record<K, infer V> ? V : T
  ): T extends Record<K, infer V> ? V : T;

  // 事件监听
  // Schema 模式时，onKey/offKey/onceKey 会为特定 key 推断精确的事件值类型
  on(listener: EventListener<T>): Unsubscribe;
  off(listener: EventListener<T>): void;
  onKey<K extends string>(
    key: K,
    listener: T extends Record<K, infer V> ? EventListener<V> : EventListener<T>
  ): Unsubscribe;
  offKey<K extends string>(
    key: K,
    listener: T extends Record<K, infer V> ? EventListener<V> : EventListener<T>
  ): void;
  once(listener: EventListener<T>): Unsubscribe;
  onceKey<K extends string>(
    key: K,
    listener: T extends Record<K, infer V> ? EventListener<V> : EventListener<T>
  ): Unsubscribe;
}
```

#### 构造函数

```typescript
constructor(
  namespace: string,
  strategy: StorageStrategy,
  options?: IsomorphicStoreOptions<T>
)
```

**参数**：

- `namespace`：数据命名空间，必须唯一。若重复将抛出 `NamespaceConflictError`
- `strategy`：存储策略
- `options`：可选配置
  - `version`：当前数据版本（默认为 1）
  - `migrations`：版本迁移规则数组

**行为**：

- 检查 `namespace` 是否已被占用，是则抛错
- 向全局注册表注册该 namespace
- 根据 `strategy` 创建并初始化对应的适配器
- 组织迁移规则，建立版本映射表

**初始化细节**：

- **LOCAL/SESSION/MEMORY**：直接创建适配器即可
- **HISTORY**：检测 `window.history.state`，若不存在或不包含该 namespace，则创建并调用 `history.replaceState()` 写入
- **NAVIGATION**：检测 `navigation.currentEntry`，获取当前 entry ID，检测 entry 的 state，若不存在或不包含该 namespace，则创建并调用 `entry.setState()` 写入

#### 方法

**`set<K extends string>(key: K, value: T extends Record<K, infer V> ? V : T): void`**

- 将数据存储在命名空间内的指定 key 下
- **类型推断**（Schema 模式）：若 `T` 是 Schema 对象，value 的类型被推断为 `T[K]`，提供编译期类型检查
- 自动添加当前版本号（以 `DataWithVersion` 结构存储）
- 自动序列化（若需要）
- 若存储空间满，根据策略的回退机制处理
- 发出 SET 事件

**`get<K extends string>(key: K): T extends Record<K, infer V> ? V | null : T | null`**

- 从命名空间内读取指定 key 的数据
- **类型推断**（Schema 模式）：返回值类型被推断为 `T[K] | null`，与对应 key 的类型定义一致
- 自动检测数据版本
- **若版本低于当前版本**，自动执行迁移链（v1→v2→v3...）
- 迁移后自动写回最新版本的数据（覆盖旧版本）
- 自动反序列化
- 不存在则返回 `null`
- 若缺少迁移规则，则抛出 `MigrationError`

**`remove(key: string): void`**

- 删除命名空间内的指定 key

**`clear(): void`**

- 清空该 IsomorphicStore 的整个命名空间

**`hasKey(key: string): boolean`**

- 检查指定 key 是否存在

**`getOrDefault<K extends string>(key: K, defaultValue: T extends Record<K, infer V> ? V : T): T extends Record<K, infer V> ? V : T`**

- 获取数据，若不存在则返回默认值
- **类型推断**（Schema 模式）：返回值类型与 defaultValue 类型一致，当 defaultValue 存在时，返回值不包含 `null`

#### 事件监听方法

**`on(listener: EventListener<T>): Unsubscribe`**

- 监听此 IsomorphicStore 的所有数据变化
- 每次 set/remove/clear 操作都会触发
- 返回取消订阅函数

**`off(listener: EventListener<T>): void`**

- 取消监听全局变化

**`onKey<K extends string>(key: K, listener: T extends Record<K, infer V> ? EventListener<V> : EventListener<T>): Unsubscribe`**

- 监听特定 key 的变化
- **类型推断**（Schema 模式）：listener 接收的事件值类型被推断为 `T[K]`，与该 key 的类型定义一致
- 仅当该 key 被 set 或 remove 时触发
- 返回取消订阅函数

**`offKey<K extends string>(key: K, listener: T extends Record<K, infer V> ? EventListener<V> : EventListener<T>): void`**

- 取消监听特定 key 的变化
- **类型推断**（Schema 模式）：lisenr 类型与 对应 key 的事件类型一致

**`once(listener: EventListener<T>): Unsubscribe`**

- 一次性监听所有数据变化
- 触发后自动取消
- 返回取消订阅函数

**`onceKey<K extends string>(key: K, listener: T extends Record<K, infer V> ? EventListener<V> : EventListener<T>): Unsubscribe`**

- 一次性监听特定 key 的变化
- **类型推断**（Schema 模式）：listener 接收的事件值类型被推断为 `T[K]`，与该 key 的类型定义一致
- 触发后自动取消
- 返回取消订阅函数

### 适配器实现

#### `LocalStorageAdapter`

使用 `window.localStorage` 实现。在命名空间下存储键值对。

**外部变化通知**：

- 监听 `storage` 事件，捕捉其他标签页对 localStorage 的修改
- 调用 `setExternalChangeCallback` 注册的回调，通知 IsomorphicStore 发出事件
- 同标签页内的修改由 IsomorphicStore 直接发出事件

#### `SessionStorageAdapter`

使用 `window.sessionStorage` 实现。在命名空间下存储键值对。

**外部变化通知**：

- 监听 `storage` 事件，捕捉同源其他标签页对 sessionStorage 的修改
- 调用 `setExternalChangeCallback` 注册的回调，通知 IsomorphicStore 发出事件
- 同标签页内的修改由 IsomorphicStore 直接发出事件

#### `MemoryStorageAdapter`

使用内存 Map 实现。在命名空间下存储键值对。

#### `HistoryStateAdapter`

**初始化（构造时）**：

```
检测 window.history.state 是否存在
  ↓
若不存在，创建 {}
  ↓
检测 history.state[namespace] 是否存在
  ↓
若不存在，添加 history.state[namespace] = {}
  ↓
调用 history.replaceState(state, '')
```

**读取**：

- 访问 `window.history.state[namespace][key]`

**写入**：

- 修改 `window.history.state[namespace]`
- 调用 `history.replaceState(state, '')` 同步状态

**特殊处理**：

- 监听 `popstate` 事件，当用户后退/前进时读取新的 history state
- 若 history state 中的数据改变，调用 `setExternalChangeCallback` 通知 IsomorphicStore 发出事件

#### `NavigationStateAdapter`

**初始化（构造时）**：

```
获取当前导航条目：navigation.currentEntry
  ↓
获取当前 entry ID：entry.id
  ↓
读取当前 entry 的 state：entry.getState()
  ↓
检测 state[namespace] 是否存在
  ↓
若不存在，创建 state[namespace] = {}
  ↓
调用 entry.setState(state)
```

**读取**：

- 调用 `navigation.currentEntry.getState()[namespace][key]`

**写入**：

- 获取当前 state
- 修改 `state[namespace]`
- 调用 `navigation.currentEntry.setState(state)` 同步状态

**特殊处理**：

- 监听 `navigate` 事件，当用户导航时检测新 entry 的 state
- 若 entry state 中的数据改变，调用 `setExternalChangeCallback` 通知 IsomorphicStore 发出事件

**注意**：

- 不需要用户传入 entry ID，自动获取当前条目
- 若浏览器不支持 Navigation API，可以降级到 History API

### 工厂类：`StorageAdapterFactory`

```typescript
class StorageAdapterFactory {
  static create(strategy: StorageStrategy): IStorageAdapter {
    switch (strategy) {
      case StorageStrategy.LOCAL:
        return new LocalStorageAdapter();
      case StorageStrategy.SESSION:
        return new SessionStorageAdapter();
      case StorageStrategy.MEMORY:
        return new MemoryStorageAdapter();
      case StorageStrategy.HISTORY:
        return new HistoryStateAdapter();
      case StorageStrategy.NAVIGATION:
        return new NavigationStateAdapter();
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }
}
```

### 命名空间注册表

全局维护一个映射表：

```typescript
const namespaceRegistry = new Map<string, StorageStrategy>();
```

**检查与注册逻辑**：

- 构造时，检查 `namespaceRegistry.has(namespace)`
- 若存在，抛出 `NamespaceConflictError`
- 否则，调用 `namespaceRegistry.set(namespace, strategy)`

## 错误处理

### 自定义异常

**`NamespaceConflictError`**

- 当试图创建同名 namespace 的 IsomorphicStore 时抛出
- 消息示例：`Namespace "app.user" is already registered with strategy LOCAL`

**`SerializationError`**

- 当数据无法序列化时抛出
- 消息示例：`Cannot serialize value for key "cache": circular reference detected`

**`StorageQuotaExceededError`**

- 当存储容量满时抛出（仅适用于 LOCAL/SESSION）
- 消息示例：`localStorage quota exceeded for namespace "app"`

**`UnsupportedStrategyError`**

- 当浏览器不支持指定策略时抛出
- 消息示例：`Navigation API is not supported in this browser`

## 使用示例

### 基础用法

```typescript
// 创建多个独立的 Store，各使用不同策略
const userPrefs = new IsomorphicStore("app.prefs", StorageStrategy.LOCAL);
const sessionData = new IsomorphicStore("app.session", StorageStrategy.SESSION);
const cache = new IsomorphicStore("app.cache", StorageStrategy.MEMORY);
const navState = new IsomorphicStore("app.nav", StorageStrategy.HISTORY);

// 每个 Store 独立操作
userPrefs.set("theme", "dark");
sessionData.set("userId", 12345);
cache.set("computed", expensiveResult);
navState.set("formStep", 2);

// 读取数据
const theme = userPrefs.get("theme"); // 'dark'
const userId = sessionData.get("userId"); // 12345
const step = navState.get("formStep"); // 2
```

### 跨存储协调

```typescript
const local = new IsomorphicStore("app.data", StorageStrategy.LOCAL);
const memory = new IsomorphicStore("app.temp", StorageStrategy.MEMORY);

// 场景：初始化时从 localStorage 加载到内存
const savedData = local.get("config");
if (savedData) {
  memory.set("config", savedData);
}

// 场景：内存修改后同步回 localStorage
const modifiedData = memory.get("config");
local.set("config", modifiedData);
```

### 版本管理

```typescript
interface UserSettings {
  displayName: string;
  theme: string;
}

// 定义迁移规则
const migrations: MigrationRule<UserSettings>[] = [
  {
    from: 1,
    to: 2,
    migrate: (data: any) => ({
      displayName: data.name || "User",
      theme: "light",
    }),
  },
];

// 创建版本化 Store
const settings = new IsomorphicStore<UserSettings>(
  "app.settings",
  StorageStrategy.LOCAL,
  {
    version: 2,
    migrations,
  },
);

// 存储和读取
settings.set("user", { displayName: "Alice", theme: "dark" });
const data = settings.get("user"); // 自动迁移旧版本数据
```

### 事件监听

```typescript
const store = new IsomorphicStore("app.user", StorageStrategy.SESSION);

// 监听所有变化
const unsub = store.on((event) => {
  console.log(`[${event.type}] ${event.key}: ${event.newValue}`);
});

// 监听特定 key
store.onKey("name", (event) => {
  console.log(`Name: ${event.oldValue} → ${event.newValue}`);
});

// 一次性监听
store.once((event) => {
  console.log("First change:", event);
});

// 执行操作触发事件
store.set("name", "John"); // 触发全局监听和 name key 监听
store.remove("name"); // 触发全局监听和 name key 监听

// 取消订阅
unsub(); // 停止监听所有变化
```

### 错误处理

```typescript
try {
  const store1 = new IsomorphicStore("app.user", StorageStrategy.LOCAL);
  const store2 = new IsomorphicStore("app.user", StorageStrategy.SESSION);
  // 抛出 NamespaceConflictError
} catch (e) {
  if (e instanceof NamespaceConflictError) {
    console.error("Namespace already in use");
  }
}
```

## 生命周期与场景

### LOCAL 生命周期

- **何时创建**：应用启动时
- **何时销毁**：用户手动清除 localStorage 或应用卸载
- **场景**：用户偏好、主题、登录状态缓存

### SESSION 生命周期

- **何时创建**：标签页打开时
- **何时销毁**：标签页关闭时
- **场景**：会话令牌、临时表单数据、请求缓存

### MEMORY 生命周期

- **何时创建**：IsomorphicStore 实例创建时
- **何时销毁**：页面刷新或应用卸载时
- **场景**：计算缓存、UI 状态、临时数据处理

### HISTORY 生命周期

- **何时创建**：IsomorphicStore 构造时，依附于当前历史条目
- **何时销毁**：用户离开该历史条目（前进/后退）
- **保留机制**：用户通过浏览器导航回到该条目时，数据恢复
- **场景**：表单状态、滚动位置、页面内导航记录

### NAVIGATION 生命周期

- **何时创建**：IsomorphicStore 构造时，依附于当前导航条目
- **何时销毁**：导航至新页面或条目
- **保留机制**：用户通过浏览器导航回到该条目时，数据恢复
- **场景**：新式 Web App 的路由状态、过渡状态

## 架构图

```
┌─────────────────────────────────────┐
│        IsomorphicStore<T> (主类)          │
│  - namespace: string                │
│  - adapter: IStorageAdapter         │
│  + set/get/remove/clear()           │
└────────────┬────────────────────────┘
             │
             ├─ StorageAdapterFactory
             │       │
             │       ├─→ LocalStorageAdapter
             │       ├─→ SessionStorageAdapter
             │       ├─→ MemoryStorageAdapter
             │       ├─→ HistoryStateAdapter
             │       └─→ NavigationStateAdapter
             │
             └─ NamespaceRegistry (全局)
                    └─ Map<namespace, strategy>
```

## 浏览器兼容性

| 策略       | 最低要求                                            |
| ---------- | --------------------------------------------------- |
| LOCAL      | IE 8+                                               |
| SESSION    | IE 8+                                               |
| MEMORY     | 所有浏览器                                          |
| HISTORY    | IE 10+                                              |
| NAVIGATION | Chrome 102+, Edge 102+ (其他浏览器可降级到 HISTORY) |

## 事件系统总结

### 事件流转机制

| 变化来源                        | 如何监听                   | 发出事件                          |
| ------------------------------- | -------------------------- | --------------------------------- |
| 同标签页 set/remove/clear       | IsomorphicStore 方法调用         | IsomorphicStore 主动 emit               |
| 其他标签页修改（LOCAL/SESSION） | Adapter 监听 storage 事件  | Adapter 通知 → IsomorphicStore emit     |
| 浏览器导航后退（HISTORY）       | Adapter 监听 popstate 事件 | Adapter 检测变化 → IsomorphicStore emit |
| 导航至新条目（NAVIGATION）      | Adapter 监听 navigate 事件 | Adapter 检测变化 → IsomorphicStore emit |

### 设计要点

1. **Adapter 无配置**：Adapter 仅做数据操作，不涉及事件逻辑
2. **IsomorphicStore 主控**：所有事件由 IsomorphicStore 发出，保证事件流统一
3. **可选通知**：Adapter 通过可选的 `setExternalChangeCallback` 与 IsomorphicStore 通信
4. **监听粒度**：支持全局、key、一次性三种监听方式

## 扩展考虑

### 可能的未来功能

1. **加密存储**：对敏感数据进行加密
2. **TTL 支持**：数据自动过期

## 总结

`IsomorphicStore` 通过**策略绑定**、**命名空间隔离**、**自动初始化**的设计，提供了清晰、安全、灵活的浏览器存储解决方案。用户可以根据数据的生命周期自由选择合适的存储策略，同时库内部保证数据不冲突、初始化完整。
