/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IsomorphicStore, StorageStrategy, globalNamespaceRegistry, MigrationError } from '../src';

describe('IsomorphicStore - Version Migrations', () => {
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
    it('should migrate data from v1 to v2 at construction time', () => {
      const storeV1 = new IsomorphicStore('test:migration', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('user', { name: 'Alice' });
      storeV1.destroy();

      const storeV2 = new IsomorphicStore(
        'test:migration',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: Record<string, any>) => {
                const user = data.user;
                return {
                  user: {
                    displayName: user?.name || 'Unknown',
                    email: ''
                  }
                };
              }
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

    it('should migrate all keys at construction time', () => {
      const storeV1 = new IsomorphicStore('test:migration-all', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('user', { name: 'Bob' });
      storeV1.set('settings', { theme: 'dark' });
      storeV1.destroy();

      const storeV2 = new IsomorphicStore(
        'test:migration-all',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: Record<string, any>) => ({
                user: { displayName: data.user?.name || 'Unknown' },
                settings: { ...data.settings, migrated: true }
              })
            }
          ]
        }
      );

      expect(storeV2.get('user')).toEqual({ displayName: 'Bob' });
      expect(storeV2.get('settings')).toEqual({ theme: 'dark', migrated: true });

      storeV2.destroy();
    });

    it('should persist migrated data with new version', () => {
      const storeV1 = new IsomorphicStore('test:migration-persist', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('user', { name: 'Charlie' });
      storeV1.destroy();

      const storeV2 = new IsomorphicStore(
        'test:migration-persist',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: Record<string, any>) => ({
                user: { displayName: data.user?.name || 'Unknown' }
              })
            }
          ]
        }
      );

      expect(storeV2.get('user')).toEqual({ displayName: 'Charlie' });
      storeV2.destroy();

      const storeV2Again = new IsomorphicStore(
        'test:migration-persist',
        StorageStrategy.LOCAL,
        {
          version: 2
        }
      );

      expect(storeV2Again.get('user')).toEqual({ displayName: 'Charlie' });
      storeV2Again.destroy();
    });
  });

  describe('Multiple migrations', () => {
    it('should execute migration chain v1 -> v2 -> v3', () => {
      const storeV1 = new IsomorphicStore('test:chain', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('data', { value: 10 });
      storeV1.destroy();

      const storeV3 = new IsomorphicStore(
        'test:chain',
        StorageStrategy.LOCAL,
        {
          version: 3,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: Record<string, any>) => ({
                data: { value: (data.data?.value || 0) * 2 }
              })
            },
            {
              from: 2,
              to: 3,
              migrate: (data: Record<string, any>) => ({
                data: {
                  value: (data.data?.value || 0) + 5,
                  timestamp: Date.now()
                }
              })
            }
          ]
        }
      );

      const result = storeV3.get('data')! as any;
      expect(result.value).toBe(25);
      expect(result.timestamp).toBeDefined();

      storeV3.destroy();
    });

    it('should skip migrations for already migrated data', () => {
      const migrations = [
        {
          from: 1,
          to: 2,
          migrate: (data: Record<string, any>) => ({
            data: { ...data.data, v2: true }
          })
        },
        {
          from: 2,
          to: 3,
          migrate: (data: Record<string, any>) => ({
            data: { ...data.data, v3: true }
          })
        }
      ];

      const storeV2 = new IsomorphicStore('test:skip', StorageStrategy.LOCAL, {
        version: 2,
        migrations: [migrations[0]]
      });

      storeV2.set('data', { v2: true });
      storeV2.destroy();

      const storeV3 = new IsomorphicStore('test:skip', StorageStrategy.LOCAL, {
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
      const storeV2 = new IsomorphicStore('test:nomig', StorageStrategy.MEMORY, {
        version: 2
      });

      const data = { name: 'Charlie', age: 25 };
      storeV2.set('user', data);
      const result = storeV2.get('user');

      expect(result).toEqual(data);

      storeV2.destroy();
    });

    it('should return data as-is when stored version is higher', () => {
      const storeV2 = new IsomorphicStore('test:downgrade', StorageStrategy.LOCAL, {
        version: 2
      });

      storeV2.set('user', { v2: true });
      storeV2.destroy();

      const storeV1 = new IsomorphicStore('test:downgrade', StorageStrategy.LOCAL, {
        version: 1
      });

      const result = storeV1.get('user');
      expect(result).toEqual({ v2: true });

      storeV1.destroy();
    });
  });

  describe('Error handling', () => {
    it('should throw MigrationError when migration rule is missing', () => {
      const storeV1 = new IsomorphicStore('test:error', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('data', { value: 1 });
      storeV1.destroy();

      expect(() => {
        new IsomorphicStore(
          'test:error',
          StorageStrategy.LOCAL,
          {
            version: 3,
            migrations: [
              {
                from: 1,
                to: 2,
                migrate: (data: Record<string, any>) => ({ ...data, v2: true })
              }
            ]
          }
        );
      }).toThrow(MigrationError);
    });

    it('should handle migration function errors', () => {
      const storeV1 = new IsomorphicStore('test:migrate-error', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('data', { value: 'hello' });
      storeV1.destroy();

      const storeV2 = new IsomorphicStore(
        'test:migrate-error',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: Record<string, any>) => ({
                data: data.data?.value?.toUpperCase()
              })
            }
          ]
        }
      );

      const result = storeV2.get('data');
      expect(result).toBe('HELLO');

      storeV2.destroy();
    });
  });

  describe('Complex migration scenarios', () => {
    it('should handle nested object migrations', () => {
      const storeV1 = new IsomorphicStore('test:nested', StorageStrategy.LOCAL, {
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

      const storeV2 = new IsomorphicStore(
        'test:nested',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: Record<string, any>) => ({
                user: {
                  fullName: `${data.user?.firstName} ${data.user?.lastName}`,
                  bio: data.user?.profile?.bio || ''
                }
              })
            }
          ]
        }
      );

      const result = storeV2.get('user')!;
      expect(result).toEqual({
        fullName: 'John Doe',
        bio: 'Developer'
      });

      storeV2.destroy();
    });

    it('should handle array migrations', () => {
      const storeV1 = new IsomorphicStore('test:array', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('items', [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' }
      ]);
      storeV1.destroy();

      const storeV2 = new IsomorphicStore(
        'test:array',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: Record<string, any>) => ({
                items: (data.items || []).map((item: any) => ({
                  ...item,
                  label: item.name.toUpperCase(),
                  deleted: false
                }))
              })
            }
          ]
        }
      );

      const result = storeV2.get('items')!;
      expect(result).toEqual([
        { id: 1, name: 'A', label: 'A', deleted: false },
        { id: 2, name: 'B', label: 'B', deleted: false }
      ]);

      storeV2.destroy();
    });

    it('should handle type transformations', () => {
      const storeV1 = new IsomorphicStore('test:transform', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('config', {
        theme: 'light',
        notifications: true
      });
      storeV1.destroy();

      const storeV2 = new IsomorphicStore(
        'test:transform',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: Record<string, any>) => ({
                config: {
                  theme: data.config?.theme,
                  notificationSettings: {
                    enabled: data.config?.notifications,
                    sound: true,
                    desktop: false
                  }
                }
              })
            }
          ]
        }
      );

      const result = storeV2.get('config')!;
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

    it('should handle adding new keys during migration', () => {
      const storeV1 = new IsomorphicStore('test:add-keys', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('user', { name: 'Alice' });
      storeV1.destroy();

      const storeV2 = new IsomorphicStore(
        'test:add-keys',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: Record<string, any>) => ({
                ...data,
                user: { displayName: data.user?.name || 'Unknown' },
                preferences: { theme: 'light' }
              })
            }
          ]
        }
      );

      expect(storeV2.get('user')).toEqual({ displayName: 'Alice' });
      expect(storeV2.get('preferences')).toEqual({ theme: 'light' });

      storeV2.destroy();
    });

    it('should handle removing keys during migration', () => {
      const storeV1 = new IsomorphicStore('test:remove-keys', StorageStrategy.LOCAL, {
        version: 1
      });

      storeV1.set('user', { name: 'Bob', temp: true });
      storeV1.set('oldData', { value: 123 });
      storeV1.destroy();

      const storeV2 = new IsomorphicStore(
        'test:remove-keys',
        StorageStrategy.LOCAL,
        {
          version: 2,
          migrations: [
            {
              from: 1,
              to: 2,
              migrate: (data: Record<string, any>) => ({
                user: { name: data.user?.name }
              })
            }
          ]
        }
      );

      expect(storeV2.get('user')).toEqual({ name: 'Bob' });
      expect(storeV2.get('oldData')).toBeNull();
      expect(storeV2.hasKey('oldData')).toBe(false);

      storeV2.destroy();
    });
  });
});
