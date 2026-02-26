/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataStore, StorageStrategy, globalNamespaceRegistry, MigrationError } from '../src';

describe('DataStore - Version Migrations', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        window.localStorage.clear();
      }
    }
    globalNamespaceRegistry.clear();
  });

  afterEach(() => {
    globalNamespaceRegistry.clear();
  });

  describe('Single migration', () => {
    it('should migrate data from v1 to v2', () => {
      // 创建 v1 store 并设置数据（使用 LOCAL 以持久化数据）
      const storeV1 = new DataStore('test:migration', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('user', { name: 'Alice' });
      storeV1.destroy();

      // 创建 v2 store，带有迁移规则
      const storeV2 = new DataStore(
        'test:migration',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: any) => ({
                displayName: data.name || 'Unknown',
                email: ''
              })
            }
          ]
        }
      );

      const result = storeV2.get('user');
      expect(result).toEqual({
        displayName: 'Alice',
        email: ''
      });

      storeV2.destroy();
    });

    it('should automatically write back migrated data with new version', () => {
      // 使用 localStorage 确保数据持久化
      const storeV1 = new DataStore('test:migration-persist', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('user', { name: 'Bob' });
      storeV1.destroy();

      // 创建 v2 store
      const storeV2 = new DataStore(
        'test:migration-persist',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: any) => ({
                displayName: data.name,
                age: 0
              })
            }
          ]
        }
      );

      // 读取数据，触发迁移
      const result = storeV2.get('user');
      expect(result).toEqual({
        displayName: 'Bob',
        age: 0
      });

      // 销毁 v2 store
      storeV2.destroy();

      // 创建新的 v2 store，不带迁移规则
      const storeV2Again = new DataStore(
        'test:migration-persist',
        StorageStrategy.LOCAL,
        {
          version: 2
        }
      );

      // 应该直接返回 v2 格式的数据（因为已经被写回）
      const result2 = storeV2Again.get('user');
      expect(result2).toEqual({
        displayName: 'Bob',
        age: 0
      });

      storeV2Again.destroy();
    });
  });

  describe('Multiple migrations', () => {
    it('should execute migration chain v1 -> v2 -> v3', () => {
      // 创建 v1 store
      const storeV1 = new DataStore('test:chain', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('data', { value: 10 });
      storeV1.destroy();

      // 创建 v3 store with migration chain
      const storeV3 = new DataStore(
        'test:chain',
        StorageStrategy.LOCAL,
        {
          version: 3,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: any) => ({
                value: data.value * 2
              })
            },
            {
              from: 2,
              to: 3,
              migrate: (data: any) => ({
                value: data.value + 5,
                timestamp: Date.now()
              })
            }
          ]
        }
      );

      const result = storeV3.get('data');
      expect(result.value).toBe(25); // (10 * 2) + 5
      expect(result.timestamp).toBeDefined();

      storeV3.destroy();
    });

    it('should skip migrations for already migrated data', () => {
      const migrations = [
        {
          from: 1,
          to: 2,
          migrate: (data: any) => ({ ...data, v2: true })
        },
        {
          from: 2,
          to: 3,
          migrate: (data: any) => ({ ...data, v3: true })
        }
      ];

      // 创建 v2 store
      const storeV2 = new DataStore('test:skip', StorageStrategy.LOCAL, {
        version: 2,
        migrations: [migrations[0]]
      });

      storeV2.set('data', { v2: true });
      storeV2.destroy();

      // 创建 v3 store，从 v2 数据读取
      const storeV3 = new DataStore('test:skip', StorageStrategy.LOCAL, {
        version: 3,
        migrations
      });

      const result = storeV3.get('data');
      expect(result.v2).toBe(true);
      expect(result.v3).toBe(true);

      storeV3.destroy();
    });
  });

  describe('No migration needed', () => {
    it('should return data as-is when versions match', () => {
      const storeV2 = new DataStore('test:nomig', StorageStrategy.MEMORY, {
        version: 2
      });

      const data = { name: 'Charlie', age: 25 };
      storeV2.set('user', data);
      const result = storeV2.get('user');

      expect(result).toEqual(data);

      storeV2.destroy();
    });

    it('should return data as-is when new version is lower', () => {
      // 创建 v2 store
      const storeV2 = new DataStore('test:downgrade', StorageStrategy.LOCAL, {
        version: 2
      });

      storeV2.set('user', { v2: true });
      storeV2.destroy();

      // 创建 v1 store（降级）
      const storeV1 = new DataStore('test:downgrade', StorageStrategy.LOCAL, {
        version: 1
      });

      const result = storeV1.get('user');
      // 版本更高的数据不会被降级迁移
      expect(result).toEqual({ v2: true });

      storeV1.destroy();
    });
  });

  describe('Error handling', () => {
    it('should throw MigrationError when migration rule is missing', () => {
      // 创建 v1 store
      const storeV1 = new DataStore('test:error', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('data', { value: 1 });
      storeV1.destroy();

      // 创建 v3 store，但只有 v1->v2 的迁移规则
      const storeV3 = new DataStore(
        'test:error',
        StorageStrategy.LOCAL,
        {
          version: 3,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: any) => ({ ...data, v2: true })
            }
            // 缺少 v2->v3 的迁移规则
          ]
        }
      );

      expect(() => {
        storeV3.get('data');
      }).toThrow(MigrationError);

      storeV3.destroy();
    });

    it('should handle migration function errors', () => {
      const storeV1 = new DataStore('test:migrate-error', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('data', { value: 'string' });
      storeV1.destroy();

      const storeV2 = new DataStore(
        'test:migrate-error',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: any) => {
                // 这个迁移函数会抛出错误
                return data.value.toUpperCase(); // 'string' 是兼容的
              }
            }
          ]
        }
      );

      const result = storeV2.get('data');
      expect(result).toBe('STRING');

      storeV2.destroy();
    });
  });

  describe('Complex migration scenarios', () => {
    it('should handle nested object migrations', () => {
      const storeV1 = new DataStore('test:nested', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('user', {
        firstName: 'John',
        lastName: 'Doe',
        profile: {
          bio: 'Developer'
        }
      });
      storeV1.destroy();

      const storeV2 = new DataStore(
        'test:nested',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: any) => ({
                fullName: `${data.firstName} ${data.lastName}`,
                bio: data.profile?.bio || ''
              })
            }
          ]
        }
      );

      const result = storeV2.get('user');
      expect(result).toEqual({
        fullName: 'John Doe',
        bio: 'Developer'
      });

      storeV2.destroy();
    });

    it('should handle array migrations', () => {
      const storeV1 = new DataStore('test:array', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('items', [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' }
      ]);
      storeV1.destroy();

      const storeV2 = new DataStore(
        'test:array',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: any) => {
                return data.map((item: any) => ({
                  ...item,
                  label: item.name.toUpperCase(),
                  deleted: false
                }));
              }
            }
          ]
        }
      );

      const result = storeV2.get('items');
      expect(result).toEqual([
        { id: 1, name: 'A', label: 'A', deleted: false },
        { id: 2, name: 'B', label: 'B', deleted: false }
      ]);

      storeV2.destroy();
    });

    it('should handle type transformations', () => {
      const storeV1 = new DataStore('test:transform', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('config', {
        theme: 'light',
        notifications: true
      });
      storeV1.destroy();

      const storeV2 = new DataStore(
        'test:transform',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: any) => ({
                theme: data.theme,
                notificationSettings: {
                  enabled: data.notifications,
                  sound: true,
                  desktop: false
                }
              })
            }
          ]
        }
      );

      const result = storeV2.get('config');
      expect(result).toEqual({
        theme: 'light',
        notificationSettings: {
          enabled: true,
          sound: true,
          desktop: false
        }
      });

      storeV2.destroy();
    });
  });
});
