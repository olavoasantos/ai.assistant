import {describe, expect, it, vi} from 'vitest';
import type {Plugin} from '@ai.assistant/contracts/plugins';
import {PLUGIN_CONTAINER_IDENTIFIER} from '../../constants';
import {createTestTelemetry} from '../../testing';
import {PluginContainer} from '../PluginContainer';

interface TestHooks {
  boot(config: {name: string}): string | void;
  transform(code: string): string;
  setup(): void;
}

type TestPlugin = Plugin<TestHooks>;

function createPlugin(name: string, hooks?: Partial<Record<string, any>>): TestPlugin {
  return {name, ...hooks} as TestPlugin;
}

describe('PluginContainer', () => {
  describe('construction and basics', () => {
    it('creates with size 0', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});

      expect(container.size).toBe(0);
    });

    it('has PLUGIN_CONTAINER_IDENTIFIER brand symbol', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});

      expect(container[PLUGIN_CONTAINER_IDENTIFIER]).toBe(true);
    });

    it('accepts contextFactory in constructor options', () => {
      const factory = vi.fn(() => ({}));
      const container = new PluginContainer<TestHooks>({
        telemetry: createTestTelemetry(),
        contextFactory: factory,
      });
      const plugin = createPlugin('test', {setup: vi.fn()});

      container.add(plugin);

      expect(factory).toHaveBeenCalledWith(plugin);
    });
  });

  describe('add() / remove()', () => {
    it('add() increases size', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const plugin = createPlugin('alpha', {setup: vi.fn()});

      container.add(plugin);

      expect(container.size).toBe(1);
    });

    it('add() returns this for fluent chaining', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const plugin = createPlugin('alpha', {setup: vi.fn()});

      const result = container.add(plugin);

      expect(result).toBe(container);
    });

    it('remove() decreases size', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const plugin = createPlugin('alpha', {setup: vi.fn()});
      container.add(plugin);

      container.remove(plugin);

      expect(container.size).toBe(0);
    });

    it('remove() returns this for fluent chaining', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const plugin = createPlugin('alpha', {setup: vi.fn()});
      container.add(plugin);

      const result = container.remove(plugin);

      expect(result).toBe(container);
    });

    it('remove() is a no-op for unknown plugins', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const known = createPlugin('known', {setup: vi.fn()});
      const unknown = createPlugin('unknown', {setup: vi.fn()});
      container.add(known);

      container.remove(unknown);

      expect(container.size).toBe(1);
    });

    it('add() throws when frozen', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.freeze();
      const plugin = createPlugin('alpha', {setup: vi.fn()});

      expect(() => container.add(plugin)).toThrow('Cannot modify a frozen plugin container.');
    });

    it('add() throws when disposed', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.dispose();
      const plugin = createPlugin('alpha', {setup: vi.fn()});

      expect(() => container.add(plugin)).toThrow('Cannot use a disposed plugin container.');
    });

    it('emits plugin:added event', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const listener = vi.fn();
      container.on('plugin:added', listener);
      const plugin = createPlugin('alpha', {setup: vi.fn()});

      container.add(plugin);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].details).toEqual({plugin: 'alpha'});
    });

    it('emits plugin:removed event', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const listener = vi.fn();
      container.on('plugin:removed', listener);
      const plugin = createPlugin('alpha', {setup: vi.fn()});
      container.add(plugin);

      container.remove(plugin);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].details).toEqual({plugin: 'alpha'});
    });
  });

  describe('has() / missing()', () => {
    it('has() returns true when any plugin has the hook', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {setup: vi.fn()}));

      expect(container.has('setup')).toBe(true);
    });

    it('has() returns false when no plugin has the hook', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {setup: vi.fn()}));

      expect(container.has('boot')).toBe(false);
    });

    it('missing() is the inverse of has()', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {setup: vi.fn()}));

      expect(container.missing('setup')).toBe(false);
      expect(container.missing('boot')).toBe(true);
    });
  });

  describe('parallel()', () => {
    it('calls all handlers concurrently', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      container.add(createPlugin('alpha', {setup: handler1}));
      container.add(createPlugin('beta', {setup: handler2}));

      await container.parallel({hook: 'setup', args: []});

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('ignores return values and resolves void', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {boot: () => 'hello'}));

      const result = await container.parallel({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBeUndefined();
    });

    it('respects ordering (pre → normal → post)', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const calls: string[] = [];
      container.add(
        createPlugin('normal', {
          setup: {handler: () => calls.push('normal'), sequential: true},
        }),
      );
      container.add(
        createPlugin('post', {
          setup: {handler: () => calls.push('post'), order: 'post', sequential: true},
        }),
      );
      container.add(
        createPlugin('pre', {
          setup: {handler: () => calls.push('pre'), order: 'pre', sequential: true},
        }),
      );

      await container.parallel({hook: 'setup', args: []});

      expect(calls).toEqual(['pre', 'normal', 'post']);
    });

    it('sequential hooks drain parallel queue', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const calls: string[] = [];
      container.add(createPlugin('alpha', {setup: () => calls.push('parallel-1')}));
      container.add(
        createPlugin('beta', {
          setup: {handler: () => calls.push('sequential'), sequential: true},
        }),
      );
      container.add(createPlugin('gamma', {setup: () => calls.push('parallel-2')}));

      await container.parallel({hook: 'setup', args: []});

      expect(calls.indexOf('parallel-1')).toBeLessThan(calls.indexOf('sequential'));
      expect(calls.indexOf('sequential')).toBeLessThan(calls.indexOf('parallel-2'));
    });

    it('fatal error halts execution', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const handler2 = vi.fn();
      container.add(
        createPlugin('alpha', {
          setup: {
            handler: () => {
              throw new Error('boom');
            },
            sequential: true,
          },
        }),
      );
      container.add(
        createPlugin('beta', {
          setup: {handler: handler2, sequential: true},
        }),
      );

      await expect(container.parallel({hook: 'setup', args: []})).rejects.toThrow();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('sequential()', () => {
    it('calls handlers one at a time in order', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const calls: string[] = [];
      container.add(createPlugin('alpha', {setup: () => calls.push('first')}));
      container.add(createPlugin('beta', {setup: () => calls.push('second')}));

      await container.sequential({hook: 'setup', args: []});

      expect(calls).toEqual(['first', 'second']);
    });

    it('respects ordering', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const calls: string[] = [];
      container.add(createPlugin('normal', {setup: () => calls.push('normal')}));
      container.add(
        createPlugin('post', {setup: {handler: () => calls.push('post'), order: 'post'}}),
      );
      container.add(createPlugin('pre', {setup: {handler: () => calls.push('pre'), order: 'pre'}}));

      await container.sequential({hook: 'setup', args: []});

      expect(calls).toEqual(['pre', 'normal', 'post']);
    });

    it('fatal error halts remaining handlers', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const handler2 = vi.fn();
      container.add(
        createPlugin('alpha', {
          setup: () => {
            throw new Error('boom');
          },
        }),
      );
      container.add(createPlugin('beta', {setup: handler2}));

      await expect(container.sequential({hook: 'setup', args: []})).rejects.toThrow();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('recoverable error continues execution', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const calls: string[] = [];
      container.add(
        createPlugin('alpha', {
          setup: {
            handler: () => {
              throw new Error('oops');
            },
            errorHandler: () => 'recoverable' as const,
          },
        }),
      );
      container.add(createPlugin('beta', {setup: () => calls.push('second')}));

      await container.sequential({hook: 'setup', args: []});

      expect(calls).toEqual(['second']);
    });
  });

  describe('first()', () => {
    it('returns first non-null result', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {boot: () => undefined}));
      container.add(createPlugin('beta', {boot: () => 'found'}));

      const result = await container.first({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBe('found');
    });

    it('skips remaining handlers after first result', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const handler3 = vi.fn();
      container.add(createPlugin('alpha', {boot: () => undefined}));
      container.add(createPlugin('beta', {boot: () => 'found'}));
      container.add(createPlugin('gamma', {boot: handler3}));

      await container.first({hook: 'boot', args: [{name: 'test'}]});

      expect(handler3).not.toHaveBeenCalled();
    });

    it('returns undefined when no handler produces a result', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {boot: () => undefined}));
      container.add(createPlugin('beta', {boot: () => null}));

      const result = await container.first({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBeUndefined();
    });
  });

  describe('reduce()', () => {
    it('accumulates results through all handlers', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {transform: (code: string) => code + '-a'}));
      container.add(createPlugin('beta', {transform: (code: string) => code + '-b'}));

      const result = await container.reduce({
        hook: 'transform',
        args: ['input'],
        initial: '',
        reduce: (_acc, val) => val,
      });

      expect(result).toBe('input-b');
    });

    it('starts with initial value', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});

      const result = await container.reduce({
        hook: 'transform',
        args: ['input'],
        initial: 'start',
        reduce: (_acc, val) => val,
      });

      expect(result).toBe('start');
    });

    it('skips undefined results', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {transform: () => undefined}));
      container.add(createPlugin('beta', {transform: (code: string) => code + '-b'}));

      const result = await container.reduce({
        hook: 'transform',
        args: ['input'],
        initial: 'initial',
        reduce: (_acc, val) => val,
      });

      expect(result).toBe('input-b');
    });
  });

  describe('pipe()', () => {
    it('passes next() to handlers', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const handler = vi.fn(({next}: any) => next());
      container.add(createPlugin('alpha', {boot: handler}));

      await container.pipe({hook: 'boot', args: [{name: 'test'}]});

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toHaveProperty('next');
    });

    it('chains handler results through middleware', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(
        createPlugin('alpha', {
          boot: async ({next, name: _name}: any) => {
            const result = await next();
            return `outer(${result})`;
          },
        }),
      );
      container.add(
        createPlugin('beta', {
          boot: ({name}: any) => `inner(${name})`,
        }),
      );

      const result = await container.pipe({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBe('outer(inner(test))');
    });

    it('returns undefined when chain ends', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {boot: ({next}: any) => next()}));

      const result = await container.pipe({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBeUndefined();
    });

    it('short-circuits when handler does not call next', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const handler2 = vi.fn();
      container.add(createPlugin('alpha', {boot: () => 'short-circuit'}));
      container.add(createPlugin('beta', {boot: handler2}));

      const result = await container.pipe({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBe('short-circuit');
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('pipeSync()', () => {
    it('works synchronously with next()', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(
        createPlugin('alpha', {
          boot: ({next, name: _name}: any) => {
            const result = next();
            return `outer(${result})`;
          },
        }),
      );
      container.add(
        createPlugin('beta', {
          boot: ({name}: any) => `inner(${name})`,
        }),
      );

      const result = container.pipeSync({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBe('outer(inner(test))');
    });
  });

  describe('renderable()', () => {
    it('returns initial children when no plugins have the hook', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});

      const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

      expect(result).toBe('base');
    });

    it('threads children through a single plugin', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(
        createPlugin('alpha', {
          boot: ({children}: any) => `[wrapped:${children}]`,
        }),
      );

      const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

      expect(result).toBe('[wrapped:base]');
    });

    it('threads children through multiple plugins in order', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(
        createPlugin('alpha', {
          boot: ({children}: any) => `[A:${children}]`,
        }),
      );
      container.add(
        createPlugin('beta', {
          boot: ({children}: any) => `[B:${children}]`,
        }),
      );

      const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

      expect(result).toBe('[B:[A:base]]');
    });

    it('skips plugins that do not implement the hook', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(
        createPlugin('alpha', {
          boot: ({children}: any) => `[A:${children}]`,
        }),
      );
      container.add(createPlugin('beta', {setup: vi.fn()}));
      container.add(
        createPlugin('gamma', {
          boot: ({children}: any) => `[C:${children}]`,
        }),
      );

      const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

      expect(result).toBe('[C:[A:base]]');
    });

    it('uses null return as intentional gate', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(
        createPlugin('alpha', {
          boot: ({children}: any) => `[A:${children}]`,
        }),
      );
      container.add(
        createPlugin('beta', {
          boot: () => null,
        }),
      );

      const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

      expect(result).toBeNull();
    });

    it('uses undefined return as intentional gate', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(
        createPlugin('alpha', {
          boot: ({children}: any) => `[A:${children}]`,
        }),
      );
      container.add(
        createPlugin('beta', {
          boot: () => undefined,
        }),
      );

      const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

      expect(result).toBeUndefined();
    });

    it('respects pre/normal/post ordering', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(
        createPlugin('post', {
          boot: {handler: ({children}: any) => `[post:${children}]`, order: 'post'},
        }),
      );
      container.add(
        createPlugin('pre', {
          boot: {handler: ({children}: any) => `[pre:${children}]`, order: 'pre'},
        }),
      );

      const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

      expect(result).toBe('[post:[pre:base]]');
    });

    it('throws when container is disposed', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.dispose();

      expect(() => container.renderable({hook: 'boot', args: [{children: 'base'} as any]})).toThrow(
        'Cannot use a disposed plugin container.',
      );
    });

    it('preserves additional properties from args[0]', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const receivedArgs: any[] = [];
      container.add(
        createPlugin('alpha', {
          boot: (props: any) => {
            receivedArgs.push(props);
            return `[A:${props.children}]`;
          },
        }),
      );

      container.renderable({
        hook: 'boot',
        args: [{children: 'base', extra: 'value'} as any],
      });

      expect(receivedArgs[0]).toEqual({children: 'base', extra: 'value'});
    });
  });

  describe('sequentialSync()', () => {
    it('calls handlers synchronously in order', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const calls: string[] = [];
      container.add(createPlugin('alpha', {setup: () => calls.push('first')}));
      container.add(createPlugin('beta', {setup: () => calls.push('second')}));

      container.sequentialSync({hook: 'setup', args: []});

      expect(calls).toEqual(['first', 'second']);
    });
  });

  describe('firstSync()', () => {
    it('returns first non-null result synchronously', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {boot: () => undefined}));
      container.add(createPlugin('beta', {boot: () => 'found'}));

      const result = container.firstSync({hook: 'boot', args: [{name: 'test'}]});

      expect(result).toBe('found');
    });
  });

  describe('reduceSync()', () => {
    it('accumulates results synchronously', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {transform: (code: string) => code + '-a'}));
      container.add(createPlugin('beta', {transform: (code: string) => code + '-b'}));

      const result = container.reduceSync({
        hook: 'transform',
        args: ['input'],
        initial: [] as string[],
        reduce: (acc, val) => [...acc, val],
      });

      expect(result).toEqual(['input-a', 'input-b']);
    });
  });

  describe('error aggregation', () => {
    it('no errorHandler means fatal — throws immediately after aggregation', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(
        createPlugin('alpha', {
          setup: () => {
            throw new Error('boom');
          },
        }),
      );

      await expect(container.sequential({hook: 'setup', args: []})).rejects.toThrow();
    });

    it('errorHandler returning recoverable continues execution', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const calls: string[] = [];
      container.add(
        createPlugin('alpha', {
          setup: {
            handler: () => {
              throw new Error('oops');
            },
            errorHandler: () => 'recoverable' as const,
          },
        }),
      );
      container.add(createPlugin('beta', {setup: () => calls.push('continued')}));

      await container.sequential({hook: 'setup', args: []});

      expect(calls).toEqual(['continued']);
    });

    it('errorHandler returning fatal halts execution', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const handler2 = vi.fn();
      container.add(
        createPlugin('alpha', {
          setup: {
            handler: () => {
              throw new Error('oops');
            },
            errorHandler: () => 'fatal' as const,
          },
        }),
      );
      container.add(createPlugin('beta', {setup: handler2}));

      await expect(container.sequential({hook: 'setup', args: []})).rejects.toThrow();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('emits plugin:hook.errored when errors occur', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const listener = vi.fn();
      container.on('plugin:hook.errored', listener);
      container.add(
        createPlugin('alpha', {
          setup: {
            handler: () => {
              throw new Error('oops');
            },
            errorHandler: () => 'recoverable' as const,
          },
        }),
      );

      await container.sequential({hook: 'setup', args: []});

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].details.hook).toBe('setup');
    });
  });

  describe('contextFactory', () => {
    it('default factory is called for each plugin on add', () => {
      const factory = vi.fn(() => ({}));
      const container = new PluginContainer<TestHooks>({
        telemetry: createTestTelemetry(),
        contextFactory: factory,
      });
      const plugin1 = createPlugin('alpha', {setup: vi.fn()});
      const plugin2 = createPlugin('beta', {setup: vi.fn()});

      container.add(plugin1);
      container.add(plugin2);

      expect(factory).toHaveBeenCalledTimes(2);
      expect(factory).toHaveBeenCalledWith(plugin1);
      expect(factory).toHaveBeenCalledWith(plugin2);
    });

    it('per-invocation factory overrides default', async () => {
      const defaultFactory = vi.fn(() => ({}));
      const invocationFactory = vi.fn(() => ({}));
      const container = new PluginContainer<TestHooks>({
        telemetry: createTestTelemetry(),
        contextFactory: defaultFactory,
      });
      const plugin = createPlugin('alpha', {setup: vi.fn()});
      container.add(plugin);
      defaultFactory.mockClear();

      await container.sequential({hook: 'setup', args: [], context: invocationFactory});

      expect(invocationFactory).toHaveBeenCalledWith(plugin);
      expect(defaultFactory).not.toHaveBeenCalled();
    });

    it('factory receives the plugin object', () => {
      const factory = vi.fn((_plugin: any) => ({}));
      const container = new PluginContainer<TestHooks>({
        telemetry: createTestTelemetry(),
        contextFactory: factory,
      });
      const plugin = createPlugin('alpha', {setup: vi.fn()});

      container.add(plugin);

      expect(factory).toHaveBeenCalledWith(plugin);
    });
  });

  describe('fork()', () => {
    it('creates child with forked runners (store isolation)', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(
        createPlugin('alpha', {
          setup() {
            (this as any).store.value = 'parent';
          },
        }),
      );

      await container.sequential({hook: 'setup', args: []});
      const child = container.fork();
      await child.sequential({hook: 'setup', args: []});

      // Both ran successfully — child is isolated
      expect(child.size).toBe(1);
    });

    it('child includes additional plugins', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {setup: vi.fn()}));

      const child = container.fork({plugins: [createPlugin('beta', {setup: vi.fn()})]});

      expect(child.size).toBe(2);
    });

    it('child inherits parent contextFactory', () => {
      const factory = vi.fn(() => ({}));
      const container = new PluginContainer<TestHooks>({
        telemetry: createTestTelemetry(),
        contextFactory: factory,
      });
      container.add(createPlugin('alpha', {setup: vi.fn()}));
      factory.mockClear();

      container.fork({plugins: [createPlugin('beta', {setup: vi.fn()})]});

      // Factory should have been called for the additional plugin
      expect(factory).toHaveBeenCalledWith(expect.objectContaining({name: 'beta'}));
    });

    it('fork options can override contextFactory', () => {
      const parentFactory = vi.fn(() => ({}));
      const childFactory = vi.fn(() => ({}));
      const container = new PluginContainer<TestHooks>({
        telemetry: createTestTelemetry(),
        contextFactory: parentFactory,
      });
      container.add(createPlugin('alpha', {setup: vi.fn()}));
      parentFactory.mockClear();

      container.fork({
        contextFactory: childFactory,
        plugins: [createPlugin('beta', {setup: vi.fn()})],
      });

      expect(childFactory).toHaveBeenCalledWith(expect.objectContaining({name: 'beta'}));
      expect(parentFactory).not.toHaveBeenCalled();
    });

    it('emits plugin:container.forked', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const listener = vi.fn();
      container.on('plugin:container.forked', listener);
      container.add(createPlugin('alpha', {setup: vi.fn()}));

      container.fork({plugins: [createPlugin('beta', {setup: vi.fn()})]});

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].details).toEqual({childSize: 2});
    });

    it('child is wired as EventEmitter child', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {setup: vi.fn()}));
      const listener = vi.fn();
      container.on('plugin:added', listener);

      const child = container.fork();
      child.add(createPlugin('beta', {setup: vi.fn()}));

      // Event from child should bubble to parent
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('freeze()', () => {
    it('prevents add/remove', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.freeze();
      const plugin = createPlugin('alpha', {setup: vi.fn()});

      expect(() => container.add(plugin)).toThrow('Cannot modify a frozen plugin container.');
      expect(() => container.remove(plugin)).toThrow('Cannot modify a frozen plugin container.');
    });

    it('execution methods still work', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const handler = vi.fn();
      container.add(createPlugin('alpha', {setup: handler}));
      container.freeze();

      await container.sequential({hook: 'setup', args: []});

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits plugin:container.frozen', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const listener = vi.fn();
      container.on('plugin:container.frozen', listener);

      container.freeze();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose()', () => {
    it('disposes all runners', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.add(createPlugin('alpha', {setup: vi.fn()}));
      container.add(createPlugin('beta', {setup: vi.fn()}));

      container.dispose();

      expect(container.size).toBe(0);
    });

    it('throws on double-dispose', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});

      container.dispose();

      expect(() => container.dispose()).toThrow('Cannot use a disposed plugin container.');
    });

    it('all methods throw after dispose', async () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      container.dispose();
      const plugin = createPlugin('alpha', {setup: vi.fn()});

      expect(() => container.add(plugin)).toThrow('Cannot use a disposed plugin container.');
      expect(() => container.remove(plugin)).toThrow('Cannot use a disposed plugin container.');
      expect(() => container.has('setup')).toThrow('Cannot use a disposed plugin container.');
      expect(() => container.missing('setup')).toThrow('Cannot use a disposed plugin container.');
      await expect(container.sequential({hook: 'setup', args: []})).rejects.toThrow(
        'Cannot use a disposed plugin container.',
      );
      await expect(container.parallel({hook: 'setup', args: []})).rejects.toThrow(
        'Cannot use a disposed plugin container.',
      );
      await expect(container.first({hook: 'setup', args: []})).rejects.toThrow(
        'Cannot use a disposed plugin container.',
      );
      expect(() => container.sequentialSync({hook: 'setup', args: []})).toThrow(
        'Cannot use a disposed plugin container.',
      );
      expect(() => container.freeze()).toThrow('Cannot use a disposed plugin container.');
      expect(() => container.fork()).toThrow('Cannot use a disposed plugin container.');
    });

    it('emits plugin:container.disposed', () => {
      const container = new PluginContainer<TestHooks>({telemetry: createTestTelemetry()});
      const listener = vi.fn();
      container.on('plugin:container.disposed', listener);

      container.dispose();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
