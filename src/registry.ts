import { StorageStrategy } from './types';
import { NamespaceConflictError } from './errors';

/**
 * 全局命名空间注册表
 */
class NamespaceRegistry {
  private registry = new Map<string, StorageStrategy>();

  /**
   * 检查命名空间是否已被注册
   */
  has(namespace: string): boolean {
    return this.registry.has(namespace);
  }

  /**
   * 获取命名空间对应的策略
   */
  get(namespace: string): StorageStrategy | undefined {
    return this.registry.get(namespace);
  }

  /**
   * 注册新的命名空间
   */
  register(namespace: string, strategy: StorageStrategy): void {
    if (this.registry.has(namespace)) {
      const existingStrategy = this.registry.get(namespace);
      throw new NamespaceConflictError(namespace, existingStrategy!);
    }
    this.registry.set(namespace, strategy);
  }

  /**
   * 注销命名空间
   */
  unregister(namespace: string): void {
    this.registry.delete(namespace);
  }

  /**
   * 清空所有注册（主要用于测试）
   */
  clear(): void {
    this.registry.clear();
  }
}

export const globalNamespaceRegistry = new NamespaceRegistry();
