/**
 * 自定义错误基类
 */
export class IsomorphicStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * 命名空间冲突错误
 */
export class NamespaceConflictError extends IsomorphicStoreError {
  constructor(namespace: string, strategy: string) {
    super(`Namespace "${namespace}" is already registered with strategy ${strategy}`);
  }
}

/**
 * 序列化错误
 */
export class SerializationError extends IsomorphicStoreError {
  constructor(key: string, reason: string) {
    super(`Cannot serialize value for key "${key}": ${reason}`);
  }
}

/**
 * 存储容量超限错误
 */
export class StorageQuotaExceededError extends IsomorphicStoreError {
  constructor(namespace: string, strategy: string) {
    super(`${strategy} quota exceeded for namespace "${namespace}"`);
  }
}

/**
 * 不支持的策略错误
 */
export class UnsupportedStrategyError extends IsomorphicStoreError {
  constructor(strategy: string) {
    super(`${strategy} API is not supported in this browser`);
  }
}

/**
 * 版本迁移错误
 */
export class MigrationError extends IsomorphicStoreError {
  constructor(fromVersion: number, toVersion: number) {
    super(`Missing migration rule from version ${fromVersion} to ${toVersion}`);
  }
}
