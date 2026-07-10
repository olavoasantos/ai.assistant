import {describe, expect, it} from 'vitest';
import {createTestTelemetry} from '../../testing';
import {PluginContext} from '../PluginContext';

const telemetry = createTestTelemetry();

describe('PluginContext', () => {
  describe('construction', () => {
    it('should create with name, empty store, and options', () => {
      const options = {logger: 'fake'} as any;
      const context = new PluginContext('my-plugin', telemetry, options);

      expect(context.name).toBe('my-plugin');
      expect(context.store).toEqual({});
      expect(context).toBeInstanceOf(PluginContext);
    });
  });

  describe('name', () => {
    it('should return the plugin name', () => {
      const context = new PluginContext('analytics', telemetry);

      expect(context.name).toBe('analytics');
    });
  });

  describe('store', () => {
    it('should return the mutable store and persist writes', () => {
      const context = new PluginContext('my-plugin', telemetry);
      const store = context.store as Record<string, unknown>;

      store.counter = 1;
      store.counter = 2;

      expect((context.store as Record<string, unknown>).counter).toBe(2);
    });

    it('should throw when disposed', () => {
      const context = new PluginContext('my-plugin', telemetry);
      context.dispose();

      expect(() => context.store).toThrow(/disposed/);
    });
  });

  describe('fork', () => {
    it('should create a child with a shallow-copied store', () => {
      const context = new PluginContext('my-plugin', telemetry);
      (context.store as Record<string, unknown>).value = 42;

      const child = context.fork();

      expect(child.name).toBe('my-plugin');
      expect((child.store as Record<string, unknown>).value).toBe(42);
      expect(child).not.toBe(context);
    });

    it('should not affect parent when child store is mutated', () => {
      const context = new PluginContext('my-plugin', telemetry);
      (context.store as Record<string, unknown>).count = 1;

      const child = context.fork();
      (child.store as Record<string, unknown>).count = 99;

      expect((context.store as Record<string, unknown>).count).toBe(1);
    });

    it('should share nested object mutations between parent and child', () => {
      const context = new PluginContext('my-plugin', telemetry);
      const nested = {items: [1, 2, 3]};
      (context.store as Record<string, unknown>).data = nested;

      const child = context.fork();
      ((child.store as Record<string, unknown>).data as {items: number[]}).items.push(4);

      expect(nested.items).toEqual([1, 2, 3, 4]);
    });

    it('should inherit parent options when no override is provided', () => {
      const options = {logger: 'parent-logger'} as any;
      const context = new PluginContext('my-plugin', telemetry, options);

      const child = context.fork();
      const view = child.buildReadonlyView();

      expect((view as any).logger).toBe('parent-logger');
    });

    it('should use override options when provided', () => {
      const parentOptions = {logger: 'parent-logger'} as any;
      const childOptions = {logger: 'child-logger'} as any;
      const context = new PluginContext('my-plugin', telemetry, parentOptions);

      const child = context.fork(childOptions);
      const view = child.buildReadonlyView();

      expect((view as any).logger).toBe('child-logger');
    });

    it('should throw when disposed', () => {
      const context = new PluginContext('my-plugin', telemetry);
      context.dispose();

      expect(() => context.fork()).toThrow(/disposed/);
    });

    it('should throw when frozen', () => {
      const context = new PluginContext('my-plugin', telemetry);
      context.freeze();

      expect(() => context.fork()).toThrow(/frozen/);
    });
  });

  describe('freeze', () => {
    it('should return the context as a readonly view', () => {
      const context = new PluginContext('my-plugin', telemetry);

      const result = context.freeze();

      expect(result).toBe(context);
    });

    it('should prevent forking after freeze', () => {
      const context = new PluginContext('my-plugin', telemetry);
      context.freeze();

      expect(() => context.fork()).toThrow(/frozen/);
    });
  });

  describe('dispose', () => {
    it('should clear the store', () => {
      const context = new PluginContext('my-plugin', telemetry);
      (context.store as Record<string, unknown>).value = 'data';

      context.dispose();

      expect(() => context.store).toThrow(/disposed/);
    });

    it('should throw on double-dispose', () => {
      const context = new PluginContext('my-plugin', telemetry);
      context.dispose();

      expect(() => context.dispose()).toThrow(/disposed/);
    });

    it('should throw on subsequent store access', () => {
      const context = new PluginContext('my-plugin', telemetry);
      context.dispose();

      expect(() => context.store).toThrow(/disposed/);
    });
  });

  describe('buildReadonlyView', () => {
    it('should include name, store, and options', () => {
      const options = {logger: 'test-logger'} as any;
      const context = new PluginContext('my-plugin', telemetry, options);
      (context.store as Record<string, unknown>).counter = 5;

      const view = context.buildReadonlyView();

      expect(view.name).toBe('my-plugin');
      expect((view.store as Record<string, unknown>).counter).toBe(5);
      expect((view as any).logger).toBe('test-logger');
    });

    it('should use override options when provided', () => {
      const options = {logger: 'original'} as any;
      const overrideOptions = {logger: 'override'} as any;
      const context = new PluginContext('my-plugin', telemetry, options);

      const view = context.buildReadonlyView(overrideOptions);

      expect((view as any).logger).toBe('override');
    });

    it('should return a frozen object', () => {
      const context = new PluginContext('my-plugin', telemetry);

      const view = context.buildReadonlyView();

      expect(Object.isFrozen(view)).toBe(true);
    });
  });
});
