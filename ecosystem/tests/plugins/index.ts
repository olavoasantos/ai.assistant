import {describe, expect, it, vi} from 'vitest';
import type * as Contract from '@ai.assistant/contracts/plugins';
import type {Telemetry} from '@ai.assistant/contracts/telemetry';

/**
 * Hook map used by the shared plugin compliance suite.
 *
 * Implementations do not need to know about this type — they only provide
 * factory functions whose return types are checked against the contract by the
 * suite.
 */
export interface ComplianceHookMap {
  boot(config: {name: string}): string | void;
  transform(code: string): string;
  setup(): void;
}

/**
 * Factories used by plugin implementations to run the shared compliance suite.
 *
 * The container is the orchestration entry point. Because the contract leaves
 * telemetry injection to implementations, the suite receives a telemetry
 * factory so it can construct isolated instances per test.
 */
export interface PluginsComplianceTestSuite {
  /** Creates a fresh telemetry instance for wiring into containers. */
  createTelemetry: (options?: {namespace?: string}) => Telemetry;

  /** Creates a fresh plugin container from construction options. */
  createPluginContainer: (options: {
    telemetry: Telemetry;
    contextFactory?: Contract.ContextFactory<Contract.Plugin<ComplianceHookMap>>;
    plugins?: Contract.Plugin<ComplianceHookMap>[];
  }) => Contract.PluginContainer<ComplianceHookMap>;
}

/** Builds a minimal plugin object for the compliance suite. */
function createPlugin(
  name: string,
  hooks?: Partial<Record<string, unknown>>,
): Contract.Plugin<ComplianceHookMap> {
  return {name, ...hooks} as Contract.Plugin<ComplianceHookMap>;
}

/**
 * Registers the shared behavioural tests every plugin implementation must
 * satisfy.
 *
 * The suite asserts the public contract and implementation-agnostic charter for
 * the plugin engine: identity branding, membership, execution strategies,
 * ordering buckets, the error model, context factories, and the fork / freeze /
 * dispose lifecycle.
 */
export function runPluginsComplianceTests(factories: PluginsComplianceTestSuite): void {
  const {createTelemetry, createPluginContainer} = factories;

  /** Convenience wrapper that builds a container with a fresh telemetry. */
  function buildContainer(options?: {
    contextFactory?: Contract.ContextFactory<Contract.Plugin<ComplianceHookMap>>;
    plugins?: Contract.Plugin<ComplianceHookMap>[];
  }): Contract.PluginContainer<ComplianceHookMap> {
    return createPluginContainer({
      telemetry: createTelemetry({namespace: 'compliance'}),
      ...options,
    });
  }

  describe('plugins compliance', () => {
    describe('construction & identity', () => {
      it('creates an empty container', () => {
        const container = buildContainer();

        expect(container.size).toBe(0);
      });

      it('exposes the branded identity symbol', () => {
        const container = buildContainer();
        const brand = Symbol.for('ai.assistant:PluginContainer');

        expect((container as unknown as Record<symbol, unknown>)[brand]).toBe(true);
      });

      it('accepts initial plugins via construction options', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {setup: vi.fn()}),
            createPlugin('beta', {setup: vi.fn()}),
          ],
        });

        expect(container.size).toBe(2);
      });
    });

    describe('add() / remove()', () => {
      it('add() increases size and returns this for chaining', () => {
        const container = buildContainer();
        const plugin = createPlugin('alpha', {setup: vi.fn()});

        const result = container.add(plugin);

        expect(result).toBe(container);
        expect(container.size).toBe(1);
      });

      it('remove() decreases size and returns this for chaining', () => {
        const container = buildContainer();
        const plugin = createPlugin('alpha', {setup: vi.fn()});
        container.add(plugin);

        const result = container.remove(plugin);

        expect(result).toBe(container);
        expect(container.size).toBe(0);
      });

      it('remove() is a no-op for unknown plugins', () => {
        const container = buildContainer();
        container.add(createPlugin('known', {setup: vi.fn()}));

        container.remove(createPlugin('unknown', {setup: vi.fn()}));

        expect(container.size).toBe(1);
      });

      it('add() throws when frozen', () => {
        const container = buildContainer();
        container.freeze();

        expect(() => container.add(createPlugin('alpha', {setup: vi.fn()}))).toThrow();
      });

      it('add() throws when disposed', () => {
        const container = buildContainer();
        container.dispose();

        expect(() => container.add(createPlugin('alpha', {setup: vi.fn()}))).toThrow();
      });

      it('emits plugin:added and plugin:removed events', () => {
        const container = buildContainer();
        const added = vi.fn();
        const removed = vi.fn();
        container.on('plugin:added', added);
        container.on('plugin:removed', removed);
        const plugin = createPlugin('alpha', {setup: vi.fn()});

        container.add(plugin);
        container.remove(plugin);

        expect(added).toHaveBeenCalledTimes(1);
        expect(added.mock.calls[0][0].details).toEqual({plugin: 'alpha'});
        expect(removed).toHaveBeenCalledTimes(1);
        expect(removed.mock.calls[0][0].details).toEqual({plugin: 'alpha'});
      });
    });

    describe('has() / missing()', () => {
      it('reflects whether any plugin implements a hook', () => {
        const container = buildContainer({plugins: [createPlugin('alpha', {setup: vi.fn()})]});

        expect(container.has('setup')).toBe(true);
        expect(container.has('boot')).toBe(false);
        expect(container.missing('setup')).toBe(false);
        expect(container.missing('boot')).toBe(true);
      });
    });

    describe('parallel()', () => {
      it('invokes all matching handlers and resolves void', async () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {setup: vi.fn()}),
            createPlugin('beta', {setup: vi.fn()}),
          ],
        });

        const result = await container.parallel({hook: 'setup', args: []});

        expect(result).toBeUndefined();
      });

      it('respects pre → default → post ordering', async () => {
        const calls: string[] = [];
        const container = buildContainer({
          plugins: [
            createPlugin('normal', {
              setup: {handler: () => calls.push('normal'), sequential: true},
            }),
            createPlugin('post', {
              setup: {handler: () => calls.push('post'), order: 'post', sequential: true},
            }),
            createPlugin('pre', {
              setup: {handler: () => calls.push('pre'), order: 'pre', sequential: true},
            }),
          ],
        });

        await container.parallel({hook: 'setup', args: []});

        expect(calls).toEqual(['pre', 'normal', 'post']);
      });

      it('sequential hooks drain the parallel queue before running', async () => {
        const calls: string[] = [];
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {setup: () => calls.push('parallel-1')}),
            createPlugin('beta', {
              setup: {handler: () => calls.push('sequential'), sequential: true},
            }),
            createPlugin('gamma', {setup: () => calls.push('parallel-2')}),
          ],
        });

        await container.parallel({hook: 'setup', args: []});

        expect(calls.indexOf('parallel-1')).toBeLessThan(calls.indexOf('sequential'));
        expect(calls.indexOf('sequential')).toBeLessThan(calls.indexOf('parallel-2'));
      });

      it('fatal errors halt execution', async () => {
        const skipped = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {
              setup: {
                handler: () => {
                  throw new Error('boom');
                },
                sequential: true,
              },
            }),
            createPlugin('beta', {setup: {handler: skipped, sequential: true}}),
          ],
        });

        await expect(container.parallel({hook: 'setup', args: []})).rejects.toThrow();
        expect(skipped).not.toHaveBeenCalled();
      });
    });

    describe('sequential()', () => {
      it('invokes handlers in registration order', async () => {
        const calls: string[] = [];
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {setup: () => calls.push('first')}),
            createPlugin('beta', {setup: () => calls.push('second')}),
          ],
        });

        await container.sequential({hook: 'setup', args: []});

        expect(calls).toEqual(['first', 'second']);
      });

      it('fatal errors halt remaining handlers', async () => {
        const skipped = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {
              setup: () => {
                throw new Error('boom');
              },
            }),
            createPlugin('beta', {setup: skipped}),
          ],
        });

        await expect(container.sequential({hook: 'setup', args: []})).rejects.toThrow();
        expect(skipped).not.toHaveBeenCalled();
      });

      it('recoverable errors emit an event and continue', async () => {
        const calls: string[] = [];
        const listener = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {
              setup: {
                handler: () => {
                  throw new Error('oops');
                },
                errorHandler: () => 'recoverable' as const,
              },
            }),
            createPlugin('beta', {setup: () => calls.push('continued')}),
          ],
        });
        container.on('plugin:hook.error', listener);

        await container.sequential({hook: 'setup', args: []});

        expect(calls).toEqual(['continued']);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].details.hook).toBe('setup');
      });

      it('errorHandler returning fatal halts execution', async () => {
        const skipped = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {
              setup: {
                handler: () => {
                  throw new Error('oops');
                },
                errorHandler: () => 'fatal' as const,
              },
            }),
            createPlugin('beta', {setup: skipped}),
          ],
        });

        await expect(container.sequential({hook: 'setup', args: []})).rejects.toThrow();
        expect(skipped).not.toHaveBeenCalled();
      });
    });

    describe('first()', () => {
      it('returns the first non-null result and skips the rest', async () => {
        const skipped = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {boot: () => undefined}),
            createPlugin('beta', {boot: () => 'found'}),
            createPlugin('gamma', {boot: skipped}),
          ],
        });

        const result = await container.first({hook: 'boot', args: [{name: 'test'}]});

        expect(result).toBe('found');
        expect(skipped).not.toHaveBeenCalled();
      });

      it('returns undefined when no handler produces a result', async () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {boot: () => undefined}),
            createPlugin('beta', {boot: () => null}),
          ],
        });

        const result = await container.first({hook: 'boot', args: [{name: 'test'}]});

        expect(result).toBeUndefined();
      });
    });

    describe('reduce()', () => {
      it('accumulates results through all handlers', async () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {transform: (code: string) => code + '-a'}),
            createPlugin('beta', {transform: (code: string) => code + '-b'}),
          ],
        });

        const result = await container.reduce({
          hook: 'transform',
          args: ['input'],
          initial: [] as string[],
          reduce: (acc, val) => [...acc, val],
        });

        expect(result).toEqual(['input-a', 'input-b']);
      });

      it('returns the initial value when no handlers match', async () => {
        const container = buildContainer();

        const result = await container.reduce({
          hook: 'transform',
          args: ['input'],
          initial: 'start',
          reduce: (_acc, val) => val,
        });

        expect(result).toBe('start');
      });

      it('skips undefined results', async () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {transform: () => undefined}),
            createPlugin('beta', {transform: (code: string) => code + '-b'}),
          ],
        });

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
      it('chains handler results through next()', async () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {
              boot: async ({next, name: _name}: any) => {
                const result = await next();
                return `outer(${result})`;
              },
            }),
            createPlugin('beta', {
              boot: ({name}: any) => `inner(${name})`,
            }),
          ],
        });

        const result = await container.pipe({hook: 'boot', args: [{name: 'test'}]});

        expect(result).toBe('outer(inner(test))');
      });

      it('short-circuits when a handler does not call next()', async () => {
        const skipped = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {boot: () => 'short-circuit'}),
            createPlugin('beta', {boot: skipped}),
          ],
        });

        const result = await container.pipe({hook: 'boot', args: [{name: 'test'}]});

        expect(result).toBe('short-circuit');
        expect(skipped).not.toHaveBeenCalled();
      });
    });

    describe('pipeSync()', () => {
      it('chains handler results synchronously through next()', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {
              boot: ({next, name: _name}: any) => {
                const result = next();
                return `outer(${result})`;
              },
            }),
            createPlugin('beta', {
              boot: ({name}: any) => `inner(${name})`,
            }),
          ],
        });

        const result = container.pipeSync({hook: 'boot', args: [{name: 'test'}]});

        expect(result).toBe('outer(inner(test))');
      });
    });

    describe('renderable()', () => {
      it('threads children through all matching handlers in order', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {boot: ({children}: any) => `[A:${children}]`}),
            createPlugin('beta', {boot: ({children}: any) => `[B:${children}]`}),
          ],
        });

        const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

        expect(result).toBe('[B:[A:base]]');
      });

      it('returns the initial children when no plugins implement the hook', () => {
        const container = buildContainer();

        const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

        expect(result).toBe('base');
      });

      it('skips plugins that do not implement the hook', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {boot: ({children}: any) => `[A:${children}]`}),
            createPlugin('beta', {setup: vi.fn()}),
            createPlugin('gamma', {boot: ({children}: any) => `[C:${children}]`}),
          ],
        });

        const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

        expect(result).toBe('[C:[A:base]]');
      });

      it('treats null or undefined returns as an intentional gate', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {boot: ({children}: any) => `[A:${children}]`}),
            createPlugin('beta', {boot: () => null}),
          ],
        });

        const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

        expect(result).toBeNull();
      });

      it('respects pre/default/post ordering', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('post', {
              boot: {handler: ({children}: any) => `[post:${children}]`, order: 'post'},
            }),
            createPlugin('pre', {
              boot: {handler: ({children}: any) => `[pre:${children}]`, order: 'pre'},
            }),
          ],
        });

        const result = container.renderable({hook: 'boot', args: [{children: 'base'} as any]});

        expect(result).toBe('[post:[pre:base]]');
      });

      it('preserves additional properties from the first argument', () => {
        const received: any[] = [];
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {
              boot: (props: any) => {
                received.push(props);
                return `[A:${props.children}]`;
              },
            }),
          ],
        });

        container.renderable({hook: 'boot', args: [{children: 'base', extra: 'value'} as any]});

        expect(received[0]).toEqual({children: 'base', extra: 'value'});
      });
    });

    describe('synchronous strategy variants', () => {
      it('sequentialSync() invokes handlers in order', () => {
        const calls: string[] = [];
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {setup: () => calls.push('first')}),
            createPlugin('beta', {setup: () => calls.push('second')}),
          ],
        });

        container.sequentialSync({hook: 'setup', args: []});

        expect(calls).toEqual(['first', 'second']);
      });

      it('firstSync() returns the first non-null result', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {boot: () => undefined}),
            createPlugin('beta', {boot: () => 'found'}),
          ],
        });

        const result = container.firstSync({hook: 'boot', args: [{name: 'test'}]});

        expect(result).toBe('found');
      });

      it('reduceSync() accumulates results', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {transform: (code: string) => code + '-a'}),
            createPlugin('beta', {transform: (code: string) => code + '-b'}),
          ],
        });

        const result = container.reduceSync({
          hook: 'transform',
          args: ['input'],
          initial: [] as string[],
          reduce: (acc, val) => [...acc, val],
        });

        expect(result).toEqual(['input-a', 'input-b']);
      });
    });

    describe('context factory', () => {
      it('default factory is called for each plugin on add', () => {
        const factory = vi.fn(() => ({}));
        const container = buildContainer({contextFactory: factory});

        container.add(createPlugin('alpha', {setup: vi.fn()}));
        container.add(createPlugin('beta', {setup: vi.fn()}));

        expect(factory).toHaveBeenCalledTimes(2);
      });

      it('per-invocation factory overrides the default', async () => {
        const defaultFactory = vi.fn(() => ({}));
        const invocationFactory = vi.fn(() => ({}));
        const container = buildContainer({contextFactory: defaultFactory});
        container.add(createPlugin('alpha', {setup: vi.fn()}));
        defaultFactory.mockClear();

        await container.sequential({hook: 'setup', args: [], context: invocationFactory});

        expect(invocationFactory).toHaveBeenCalled();
        expect(defaultFactory).not.toHaveBeenCalled();
      });
    });

    describe('fork()', () => {
      it('creates a child with forked runners providing store isolation', async () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {
              setup() {
                (this as any).store.value = 'parent';
              },
            }),
          ],
        });

        await container.sequential({hook: 'setup', args: []});
        const child = container.fork();
        await child.sequential({hook: 'setup', args: []});

        expect(child.size).toBe(1);
      });

      it('child includes additional plugins beyond inherited ones', () => {
        const container = buildContainer({plugins: [createPlugin('alpha', {setup: vi.fn()})]});

        const child = container.fork({plugins: [createPlugin('beta', {setup: vi.fn()})]});

        expect(child.size).toBe(2);
      });

      it('child inherits the parent context factory unless overridden', () => {
        const parentFactory = vi.fn(() => ({}));
        const childFactory = vi.fn(() => ({}));
        const container = buildContainer({contextFactory: parentFactory});
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
        const container = buildContainer({plugins: [createPlugin('alpha', {setup: vi.fn()})]});
        const listener = vi.fn();
        container.on('plugin:container.forked', listener);

        container.fork({plugins: [createPlugin('beta', {setup: vi.fn()})]});

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].details).toEqual({childSize: 2});
      });

      it('child is wired as an EventEmitter child of the parent', () => {
        const container = buildContainer({plugins: [createPlugin('alpha', {setup: vi.fn()})]});
        const listener = vi.fn();
        container.on('plugin:added', listener);

        const child = container.fork();
        child.add(createPlugin('beta', {setup: vi.fn()}));

        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe('freeze()', () => {
      it('prevents add() and remove()', () => {
        const container = buildContainer();
        container.freeze();
        const plugin = createPlugin('alpha', {setup: vi.fn()});

        expect(() => container.add(plugin)).toThrow();
        expect(() => container.remove(plugin)).toThrow();
      });

      it('execution methods remain available', async () => {
        const handler = vi.fn();
        const container = buildContainer({plugins: [createPlugin('alpha', {setup: handler})]});
        container.freeze();

        await container.sequential({hook: 'setup', args: []});

        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('emits plugin:container.frozen', () => {
        const container = buildContainer();
        const listener = vi.fn();
        container.on('plugin:container.frozen', listener);

        container.freeze();

        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe('dispose()', () => {
      it('clears all runners', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {setup: vi.fn()}),
            createPlugin('beta', {setup: vi.fn()}),
          ],
        });

        container.dispose();

        expect(container.size).toBe(0);
      });

      it('throws on double-dispose', () => {
        const container = buildContainer();

        container.dispose();

        expect(() => container.dispose()).toThrow();
      });

      it('all methods throw after disposal', async () => {
        const container = buildContainer();
        container.dispose();
        const plugin = createPlugin('alpha', {setup: vi.fn()});

        expect(() => container.add(plugin)).toThrow();
        expect(() => container.has('setup')).toThrow();
        await expect(container.sequential({hook: 'setup', args: []})).rejects.toThrow();
        expect(() => container.sequentialSync({hook: 'setup', args: []})).toThrow();
        expect(() => container.freeze()).toThrow();
        expect(() => container.fork()).toThrow();
      });

      it('emits plugin:container.disposed', () => {
        const container = buildContainer();
        const listener = vi.fn();
        container.on('plugin:container.disposed', listener);

        container.dispose();

        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });
}
