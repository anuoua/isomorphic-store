/**
 * 存储策略枚举
 */
export enum StorageStrategy {
  LOCAL = 'local',
  SESSION = 'session',
  MEMORY = 'memory',
  HISTORY = 'history',
  NAVIGATION = 'navigation'
}

/**
 * 数据变化事件类型枚举
 */
export enum DataStoreEventType {
  SET = 'set',       // 设置或更新数据
  REMOVE = 'remove', // 删除数据
  CLEAR = 'clear'    // 清空命名空间
}

/**
 * 数据版本包装结构
 */
export interface DataWithVersion<T = unknown> {
  version: number;     // 数据版本号
  data: T;            // 实际数据
}

/**
 * 版本迁移规则
 */
export interface MigrationRule<T = unknown> {
  from: number;                          // 源版本
  to: number;                            // 目标版本
  migrate: (data: unknown) => T;         // 迁移函数
}

/**
 * DataStore 配置选项
 */
export interface DataStoreOptions<T = unknown> {
  version?: number;                      // 当前版本（默认为 1）
  migrations?: MigrationRule<T>[];       // 迁移规则
}

/**
 * 数据变化事件对象
 */
export interface DataStoreEvent<T = unknown> {
  type: DataStoreEventType;
  key?: string;              // SET/REMOVE 时存在，CLEAR 时无
  oldValue?: T;              // SET/REMOVE 时存在
  newValue?: T;              // SET 时存在，REMOVE 时为 undefined
  namespace: string;         // 命名空间
  timestamp: number;         // 事件发生时间戳（毫秒）
  source: any;               // 事件来源，指向 DataStore 实例
}

/**
 * 事件监听器类型
 */
export type EventListener<T = unknown> = (event: DataStoreEvent<T>) => void;

/**
 * 取消订阅函数类型
 */
export type Unsubscribe = () => void;

/**
 * 存储适配器接口
 */
export interface IStorageAdapter<T = unknown> {
  get(key: string): T | null;
  set(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
  hasKey(key: string): boolean;
  // 可选：Adapter 可注册外部变化回调
  setExternalChangeCallback?(callback: (event: DataStoreEvent<T>) => void): void;
}
