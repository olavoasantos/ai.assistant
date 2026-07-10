import {describe, expect, it, vi} from 'vitest';
import {PLUGIN_RUNNER_IDENTIFIER} from '../../constants';
import {createTestTelemetry} from '../../testing';
import {PluginRunner} from '../PluginRunner';

const telemetry = createTestTelemetry();

interface TestHooks {
  boot(config: {name: string}): string;
  transform(code: string): string;
}

describe('PluginRunner', () => {
  describe('Construction & Identity', () => {
    it('creates runner with plugin name', () => {
      const runner = new PluginRunner<TestHooks>({name: 'my-plugin'}, {telemetry});

      expect(runner.name).toBe('my-plugin');
    });

    it('has PLUGIN_RUNNER_IDENTIFIER brand symbol', () => {
      const runner = new PluginRunner<TestHooks>({name: 'my-plugin'}, {telemetry});

      expect(runner[PLUGIN_RUNNER_IDENTIFIER]).toBe(true);
    });
  });

  describe('has() / missing()', () => {
    it('returns true for registered hooks', () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: () => 'ok',
        },
        {telemetry},
      );

      expect(runner.has('boot')).toBe(true);
    });

    it('returns false for unregistered hooks', () => {
      const runner = new PluginRunner<TestHooks>({name: 'my-plugin'}, {telemetry});

      expect(runner.has('boot')).toBe(false);
    });

    it('missing() is the inverse of has()', () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: () => 'ok',
        },
        {telemetry},
      );

      expect(runner.missing('boot')).toBe(false);
      expect(runner.missing('transform')).toBe(true);
    });
  });

  describe('trigger() — basic', () => {
    it('returns undefined when hook does not exist', async () => {
      const runner = new PluginRunner<TestHooks>({name: 'my-plugin'}, {telemetry});

      const result = await runner.trigger({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBeUndefined();
    });

    it('calls handler with correct args', async () => {
      const handler = vi.fn(() => 'done');
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: handler,
        },
        {telemetry},
      );

      await runner.trigger({hook: 'boot', args: [{name: 'test'}]});

      expect(handler).toHaveBeenCalledWith({name: 'test'});
    });

    it('binds this to readonly context view', async () => {
      let captured: unknown;
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot(this: any) {
            captured = this;
            return 'ok';
          },
        },
        {telemetry},
      );

      await runner.trigger({hook: 'boot', args: [{name: 'test'}]});

      expect(captured).not.toBeNull();
      expect(Object.isFrozen(captured)).toBe(true);
    });

    it('plugin can access this.name in handler', async () => {
      let capturedName: string | undefined;
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot(this: any) {
            capturedName = this.name;
            return 'ok';
          },
        },
        {telemetry},
      );

      await runner.trigger({hook: 'boot', args: [{name: 'test'}]});

      expect(capturedName).toBe('my-plugin');
    });

    it('plugin can read/write this.store in handler', async () => {
      let storeValue: unknown;
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot(this: any) {
            this.store.counter = 42;
            return 'first';
          },
          transform(this: any) {
            storeValue = this.store.counter;
            return 'second';
          },
        },
        {telemetry},
      );

      await runner.trigger({hook: 'boot', args: [{name: 'test'}]});
      await runner.trigger({hook: 'transform', args: ['code']});

      expect(storeValue).toBe(42);
    });

    it('returns handler return value', async () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: () => 'booted',
        },
        {telemetry},
      );

      const result = await runner.trigger({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBe('booted');
    });
  });

  describe('triggerSync() — basic', () => {
    it('returns undefined when hook does not exist', () => {
      const runner = new PluginRunner<TestHooks>({name: 'my-plugin'}, {telemetry});

      const result = runner.triggerSync({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBeUndefined();
    });

    it('calls handler synchronously', () => {
      const handler = vi.fn(() => 'done');
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: handler,
        },
        {telemetry},
      );

      runner.triggerSync({hook: 'boot', args: [{name: 'test'}]});

      expect(handler).toHaveBeenCalledWith({name: 'test'});
    });

    it('returns handler return value', () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          transform: (code) => code.toUpperCase(),
        },
        {telemetry},
      );

      const result = runner.triggerSync({hook: 'transform', args: ['hello']});

      expect(result).toBe('HELLO');
    });
  });

  describe('trigger() — context options', () => {
    it('passes context options through to this', async () => {
      let capturedContext: any;
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot(this: any) {
            capturedContext = this;
            return 'ok';
          },
        },
        {telemetry, context: {logger: 'base-logger'} as any},
      );

      await runner.trigger({hook: 'boot', args: [{name: 'test'}]});

      expect(capturedContext.logger).toBe('base-logger');
    });

    it('per-invocation options override persistent ones', async () => {
      let capturedContext: any;
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot(this: any) {
            capturedContext = this;
            return 'ok';
          },
        },
        {telemetry, context: {logger: 'base-logger'} as any},
      );

      await runner.trigger({
        hook: 'boot',
        args: [{name: 'test'}],
        context: {logger: 'override-logger'} as any,
      });

      expect(capturedContext.logger).toBe('override-logger');
    });
  });

  describe('Hook normalization', () => {
    it('bare function hooks are normalized without order, errorHandler, or cacheHandler', () => {
      const handler = vi.fn(() => 'ok');
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: handler,
        },
        {telemetry},
      );

      const hook = runner.getHook('boot');

      expect(hook).toBeDefined();
      expect(hook!.handler).toBe(handler);
      expect(hook!.order).toBeUndefined();
      expect(hook!.errorHandler).toBeUndefined();
      expect(hook!.cacheHandler).toBeUndefined();
      expect(hook!.sequential).toBe(false);
    });

    it('object hooks preserve order, errorHandler, cacheHandler, and sequential', () => {
      const handler = vi.fn(() => 'ok');
      const errorHandler = vi.fn(() => 'fatal' as const);
      const cacheHandler = vi.fn(() => ({key: 'k'}));

      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: {
            handler,
            order: 'pre',
            errorHandler,
            cacheHandler,
            sequential: true,
          },
        },
        {telemetry},
      );

      const hook = runner.getHook('boot');

      expect(hook).toBeDefined();
      expect(hook!.handler).toBe(handler);
      expect(hook!.order).toBe('pre');
      expect(hook!.errorHandler).toBe(errorHandler);
      expect(hook!.cacheHandler).toBe(cacheHandler);
      expect(hook!.sequential).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('errors propagate to caller without enrichment', async () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot() {
            throw new Error('boom');
          },
        },
        {telemetry},
      );

      await expect(runner.trigger({hook: 'boot', args: [{name: 'test'}]})).rejects.toThrow('boom');
    });

    it('errorHandler metadata is preserved for container use', () => {
      const errorHandler = vi.fn(() => 'fatal' as const);
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: {
            handler() {
              throw new Error('boom');
            },
            errorHandler,
          },
        },
        {telemetry},
      );

      // The errorHandler is stored in normalized hooks for the container to use
      const hook = runner.getHook('boot');
      expect(hook?.errorHandler).toBe(errorHandler);
    });

    it('sync errors propagate to caller', () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot() {
            throw new Error('sync boom');
          },
        },
        {telemetry},
      );

      expect(() => runner.triggerSync({hook: 'boot', args: [{name: 'test'}]})).toThrow('sync boom');
    });

    it('emits plugin:hook.error for recoverable errors', async () => {
      const listener = vi.fn();
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: {
            handler() {
              throw new Error('recoverable boom');
            },
            errorHandler: () => 'recoverable',
          },
        },
        {telemetry},
      );
      runner.on('plugin:hook.error', listener);

      const result = await runner.trigger({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBeUndefined();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].details).toMatchObject({
        plugin: 'my-plugin',
        hook: 'boot',
      });
    });
  });

  describe('Caching', () => {
    it('cache miss calls handler and stores result', async () => {
      const handler = vi.fn(() => 'result');
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          transform: {
            handler,
            cacheHandler: (code) => ({key: code}),
          },
        },
        {telemetry},
      );

      const result = await runner.trigger({hook: 'transform', args: ['hello']});

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    it('cache hit returns stored value without calling handler', async () => {
      const handler = vi.fn(() => 'result');
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          transform: {
            handler,
            cacheHandler: (code) => ({key: code}),
          },
        },
        {telemetry},
      );

      await runner.trigger({hook: 'transform', args: ['hello']});
      const result = await runner.trigger({hook: 'transform', args: ['hello']});

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    it('expired cache re-invokes handler', async () => {
      vi.useFakeTimers();
      const handler = vi.fn(() => 'result');
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          transform: {
            handler,
            cacheHandler: (code) => ({key: code, ttl: 100}),
          },
        },
        {telemetry},
      );

      await runner.trigger({hook: 'transform', args: ['hello']});
      vi.advanceTimersByTime(101);
      await runner.trigger({hook: 'transform', args: ['hello']});

      expect(handler).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('emits plugin:hook.cache.hit on cache hit', async () => {
      const listener = vi.fn();
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          transform: {
            handler: () => 'result',
            cacheHandler: (code) => ({key: code}),
          },
        },
        {telemetry},
      );
      runner.on('plugin:hook.cache.hit', listener);

      await runner.trigger({hook: 'transform', args: ['hello']});
      await runner.trigger({hook: 'transform', args: ['hello']});

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].details).toMatchObject({
        plugin: 'my-plugin',
        hook: 'transform',
      });
    });
  });

  describe('fork()', () => {
    it('creates child runner with same plugin', () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: () => 'ok',
        },
        {telemetry},
      );

      const child = runner.fork();

      expect(child.name).toBe('my-plugin');
      expect(child.has('boot')).toBe(true);
    });

    it('child has independent store (shallow copy)', async () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'store-test',
          boot(this: any) {
            this.store.x = 'parent-value';
            return 'ok';
          },
          transform(this: any) {
            return this.store.x;
          },
        },
        {telemetry},
      );

      // Populate parent store
      await runner.trigger({hook: 'boot', args: [{name: 'a'}]});
      const child = runner.fork();

      // Child inherits the shallow-copied store
      const childResult = child.triggerSync({hook: 'transform', args: ['x']});
      expect(childResult).toBe('parent-value');

      // Mutate child store via its own boot hook
      await child.trigger({hook: 'boot', args: [{name: 'b'}]});

      // Parent store remains unchanged
      const parentResult = runner.triggerSync({hook: 'transform', args: ['x']});
      expect(parentResult).toBe('parent-value');
    });

    it('does not automatically wire event bubbling (caller responsibility)', () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: {
            handler() {
              throw new Error('test');
            },
            errorHandler: () => 'recoverable',
          },
        },
        {telemetry},
      );
      const parentListener = vi.fn();
      runner.on('plugin:hook.error', parentListener);

      const child = runner.fork();
      child.triggerSync({hook: 'boot', args: [{name: 'test'}]});

      expect(parentListener).toHaveBeenCalledTimes(0);
    });
  });

  describe('freeze()', () => {
    it('prevents forking after freeze', () => {
      const runner = new PluginRunner<TestHooks>({name: 'my-plugin'}, {telemetry});
      runner.freeze();

      expect(() => runner.fork()).toThrow();
    });

    it('trigger() still works on frozen runner', async () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: () => 'frozen-result',
        },
        {telemetry},
      );
      runner.freeze();

      const result = await runner.trigger({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBe('frozen-result');
    });
  });

  describe('dispose()', () => {
    it('throws on double-dispose', () => {
      const runner = new PluginRunner<TestHooks>({name: 'my-plugin'}, {telemetry});
      runner.dispose();

      expect(() => runner.dispose()).toThrow();
    });

    it('all methods throw after dispose', async () => {
      const runner = new PluginRunner<TestHooks>(
        {
          name: 'my-plugin',
          boot: () => 'ok',
        },
        {telemetry},
      );
      runner.dispose();

      expect(() => runner.has('boot')).toThrow();
      expect(() => runner.missing('boot')).toThrow();
      expect(() => runner.fork()).toThrow();
      await expect(runner.trigger({hook: 'boot', args: [{name: 'test'}]})).rejects.toThrow();
      expect(() => runner.triggerSync({hook: 'boot', args: [{name: 'test'}]})).toThrow();
    });
  });
});
