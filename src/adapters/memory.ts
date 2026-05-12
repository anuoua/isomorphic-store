import { type IStorageAdapter } from '../types';

/**
 * 内存存储适配器
 * 使用内存 Map 实现存储
 */
export class MemoryStorageAdapter<T = unknown> implements IStorageAdapter<T> {
  private storage = new Map<string, T>();

  get(key: string): T | null {
    return this.storage.get(key) ?? null;
  }

  set(key: string, value: T): void {
    this.storage.set(key, value);
  }

  remove(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }

  hasKey(key: string): boolean {
    return this.storage.has(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.storage.keys());
  }
}
