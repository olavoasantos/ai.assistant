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

    describe('protect()', () => {
      it('protects registered plugins while leaving other membership mutable', () => {
        const protectedPlugin = createPlugin('protected', {setup: vi.fn()});
        const localPlugin = createPlugin('local', {setup: vi.fn()});
        const container = buildContainer({plugins: [protectedPlugin, localPlugin]});

        const result = container.protect(protectedPlugin);
        container.remove(localPlugin).add(createPlugin('replacement', {setup: vi.fn()}));

        expect(result).toBe(container);
        expect(() => container.remove(protectedPlugin)).toThrow();
        expect(container.size).toBe(2);
      });

      it('is idempotent and throws for an unknown plugin', () => {
        const plugin = createPlugin('protected', {setup: vi.fn()});
        const container = buildContainer({plugins: [plugin]});

        container.protect(plugin).protect(plugin);

        expect(() => container.protect(createPlugin('unknown'))).toThrow();
        expect(container.size).toBe(1);
      });

      it('protects every registration of the same plugin object', () => {
        const plugin = createPlugin('duplicate', {setup: vi.fn()});
        const container = buildContainer({plugins: [plugin, plugin]});

        container.protect(plugin);

        expect(() => container.remove(plugin)).toThrow();
        expect(container.size).toBe(2);
      });

      it('copies inherited protection into forks', () => {
        const plugin = createPlugin('protected', {setup: vi.fn()});
        const container = buildContainer({plugins: [plugin]});
        container.protect(plugin);

        const child = container.fork();

        expect(() => child.remove(plugin)).toThrow();
      });

      it('does not prevent terminal disposal', () => {
        const plugin = createPlugin('protected', {setup: vi.fn()});
        const container = buildContainer({plugins: [plugin]});
        container.protect(plugin);

        container.dispose();

        expect(container.size).toBe(0);
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
        container.on('plugin:hook.errored', listener);

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

    describe('observe() / observeSync()', () => {
      it('contains fatal observer failures and stops the current run', async () => {
        const skipped = vi.fn();
        const listener = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('failing', {
              setup: () => {
                throw new Error('observer failed');
              },
            }),
            createPlugin('skipped', {setup: skipped}),
          ],
        });
        container.on('plugin:observation.errored', listener);

        await expect(container.observe({hook: 'setup', args: []})).resolves.toBeUndefined();

        expect(skipped).not.toHaveBeenCalled();
        expect(listener).toHaveBeenCalledTimes(1);
      });

      it('contains fatal observer failures synchronously', () => {
        const skipped = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('failing', {
              setup: () => {
                throw new Error('observer failed');
              },
            }),
            createPlugin('skipped', {setup: skipped}),
          ],
        });

        expect(() => container.observeSync({hook: 'setup', args: []})).not.toThrow();
        expect(skipped).not.toHaveBeenCalled();
      });

      it('contains failures from observation diagnostic listeners', async () => {
        const container = buildContainer({
          plugins: [
            createPlugin('failing', {
              setup: () => {
                throw new Error('observer failed');
              },
            }),
          ],
        });
        container.on('plugin:observation.errored', () => {
          throw new Error('diagnostic listener failed');
        });

        await expect(container.observe({hook: 'setup', args: []})).resolves.toBeUndefined();
      });

      it('contains synchronous diagnostic listener failures', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('failing', {
              setup: () => {
                throw new Error('observer failed');
              },
            }),
          ],
        });
        container.on('plugin:observation.errored', () => {
          throw new Error('diagnostic listener failed');
        });

        expect(() => container.observeSync({hook: 'setup', args: []})).not.toThrow();
      });

      it('continues after recoverable observer failures asynchronously', async () => {
        const continued = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('recoverable', {
              setup: {
                handler: () => {
                  throw new Error('observer failed');
                },
                errorHandler: () => 'recoverable' as const,
              },
            }),
            createPlugin('continued', {setup: continued}),
          ],
        });

        await container.observe({hook: 'setup', args: []});
        expect(continued).toHaveBeenCalledTimes(1);
      });

      it('continues after recoverable observer failures synchronously', () => {
        const continued = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('recoverable', {
              setup: {
                handler: () => {
                  throw new Error('observer failed');
                },
                errorHandler: () => 'recoverable' as const,
              },
            }),
            createPlugin('continued', {setup: continued}),
          ],
        });

        expect(() => container.observeSync({hook: 'setup', args: []})).not.toThrow();
        expect(continued).toHaveBeenCalledTimes(1);
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

    describe('direct()', () => {
      it('preserves order and first-result short-circuiting across repeated calls', () => {
        const skipped = vi.fn();
        const container = buildContainer({
          plugins: [
            createPlugin('empty', {boot: () => undefined}),
            createPlugin('match', {boot: ({name}: {name: string}) => `found:${name}`}),
            createPlugin('skipped', {boot: skipped}),
          ],
        });

        const result = container.direct({
          hook: 'boot',
          execute: (executor) => [executor.first([{name: 'one'}]), executor.first([{name: 'two'}])],
        });

        expect(result).toEqual(['found:one', 'found:two']);
        expect(skipped).not.toHaveBeenCalled();
      });

      it('prepares context once per plugin for the scope', () => {
        const factory = vi.fn(() => ({}));
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {setup: vi.fn()}),
            createPlugin('beta', {setup: vi.fn()}),
          ],
        });

        container.direct({
          hook: 'setup',
          context: factory,
          execute(executor) {
            executor.sequential([]);
            executor.sequential([]);
          },
        });

        expect(factory).toHaveBeenCalledTimes(2);
      });

      it('preserves hook caching without invoking handlers repeatedly', () => {
        const handler = vi.fn(() => 'cached');
        const container = buildContainer({
          plugins: [
            createPlugin('cached', {
              transform: {handler, cacheHandler: (code: string) => ({key: code})},
            }),
          ],
        });

        const result = container.direct({
          hook: 'transform',
          execute: (executor) => [executor.first(['same']), executor.first(['same'])],
        });

        expect(result).toEqual(['cached', 'cached']);
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('uses a membership snapshot until the scope returns', () => {
        const calls: string[] = [];
        const container = buildContainer({
          plugins: [createPlugin('initial', {setup: () => calls.push('initial')})],
        });

        container.direct({
          hook: 'setup',
          execute(executor) {
            container.add(createPlugin('later', {setup: () => calls.push('later')}));
            executor.sequential([]);
          },
        });
        container.sequentialSync({hook: 'setup', args: []});

        expect(calls).toEqual(['initial', 'initial', 'later']);
      });

      it('keeps removed snapshot runners alive until the scope returns', () => {
        const handler = vi.fn();
        const plugin = createPlugin('removable', {setup: handler});
        const container = buildContainer({plugins: [plugin]});

        container.direct({
          hook: 'setup',
          execute(executor) {
            container.remove(plugin);
            executor.sequential([]);
          },
        });
        container.sequentialSync({hook: 'setup', args: []});

        expect(handler).toHaveBeenCalledTimes(1);
        expect(container.size).toBe(0);
      });

      it('invalidates an escaped executor and rejects asynchronous callbacks', () => {
        let escaped: Contract.PluginDirectExecutor<ComplianceHookMap['setup']> | undefined;
        const container = buildContainer({plugins: [createPlugin('alpha', {setup: vi.fn()})]});

        container.direct({
          hook: 'setup',
          execute(executor) {
            escaped = executor;
          },
        });

        expect(() => escaped?.sequential([])).toThrow();
        expect(() =>
          container.direct({
            hook: 'setup',
            execute: async (executor) => {
              await Promise.resolve();
              executor.sequential([]);
            },
          }),
        ).toThrow();

        const asynchronousHook = buildContainer({
          plugins: [createPlugin('async', {setup: async () => undefined})],
        });
        expect(() =>
          asynchronousHook.direct({
            hook: 'setup',
            execute: (executor) => executor.sequential([]),
          }),
        ).toThrow('Synchronous plugin execution cannot accept a promise result.');
      });

      it('continues after recoverable failures and propagates fatal failures', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('recoverable', {
              boot: {
                handler: () => {
                  throw new Error('recoverable');
                },
                errorHandler: () => 'recoverable' as const,
              },
            }),
            createPlugin('match', {boot: () => 'matched'}),
          ],
        });

        expect(
          container.direct({hook: 'boot', execute: (executor) => executor.first([{name: 'x'}])}),
        ).toBe('matched');

        const fatal = buildContainer({
          plugins: [
            createPlugin('fatal', {
              setup: () => {
                throw new Error('fatal');
              },
            }),
          ],
        });
        expect(() =>
          fatal.direct({hook: 'setup', execute: (executor) => executor.sequential([])}),
        ).toThrow();
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
      it('rejects a null first argument before middleware executes', async () => {
        const handler = vi.fn();
        const container = buildContainer({plugins: [createPlugin('alpha', {boot: handler})]});

        await expect(container.pipe({hook: 'boot', args: [null]} as any)).rejects.toThrow(
          'Plugin pipe execution requires an object as its first hook argument.',
        );
        expect(handler).not.toHaveBeenCalled();
      });

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

      it('calls a terminal continuation after the final middleware', async () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {
              boot: async ({next}: any) => `outer(${await next()})`,
            }),
          ],
        });

        const result = await container.pipe({
          hook: 'boot',
          args: [{name: 'test'}],
          terminal: ({name}) => `terminal(${name})`,
        });

        expect(result).toBe('outer(terminal(test))');
      });

      it('rejects a second call to the same continuation', async () => {
        const container = buildContainer({
          plugins: [
            createPlugin('alpha', {
              boot: {
                handler: async ({next}: any) => {
                  await next();
                  return next();
                },
                errorHandler: () => 'recoverable' as const,
              },
            }),
          ],
        });

        await expect(
          container.pipe({hook: 'boot', args: [{name: 'test'}], terminal: () => 'done'}),
        ).rejects.toThrow();
      });

      it('does not repeat downstream work when middleware recovers after next()', async () => {
        const downstream = vi.fn(() => 'continued');
        const container = buildContainer({
          plugins: [
            createPlugin('recoverable', {
              boot: {
                handler: async ({next}: any) => {
                  await next();
                  throw new Error('recoverable after next');
                },
                errorHandler: () => 'recoverable' as const,
              },
            }),
            createPlugin('downstream', {boot: downstream}),
          ],
        });

        const result = await container.pipe({hook: 'boot', args: [{name: 'test'}]});

        expect(result).toBe('continued');
        expect(downstream).toHaveBeenCalledTimes(1);
      });

      it('skips recoverably failing middleware and continues the chain', async () => {
        const container = buildContainer({
          plugins: [
            createPlugin('recoverable', {
              boot: {
                handler: () => {
                  throw new Error('recoverable');
                },
                errorHandler: () => 'recoverable' as const,
              },
            }),
            createPlugin('next', {boot: ({name}: any) => `continued:${name}`}),
          ],
        });

        const result = await container.pipe({hook: 'boot', args: [{name: 'test'}]});

        expect(result).toBe('continued:test');
      });
    });

    describe('pipeSync()', () => {
      it('rejects a primitive first argument before middleware executes', () => {
        const handler = vi.fn();
        const container = buildContainer({plugins: [createPlugin('alpha', {boot: handler})]});

        expect(() => container.pipeSync({hook: 'boot', args: ['invalid']} as any)).toThrow(
          'Plugin pipe execution requires an object as its first hook argument.',
        );
        expect(handler).not.toHaveBeenCalled();
      });

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

      it('continues after recoverable synchronous middleware failures', () => {
        const downstream = vi.fn(() => 'continued');
        const container = buildContainer({
          plugins: [
            createPlugin('recoverable', {
              boot: {
                handler: () => {
                  throw new Error('recoverable');
                },
                errorHandler: () => 'recoverable' as const,
              },
            }),
            createPlugin('downstream', {boot: downstream}),
          ],
        });

        const result = container.pipeSync({hook: 'boot', args: [{name: 'test'}]});

        expect(result).toBe('continued');
        expect(downstream).toHaveBeenCalledTimes(1);
      });

      it('does not repeat downstream work when synchronous middleware recovers after next()', () => {
        const downstream = vi.fn(() => 'continued');
        const container = buildContainer({
          plugins: [
            createPlugin('recoverable', {
              boot: {
                handler: ({next}: any) => {
                  next();
                  throw new Error('recoverable after next');
                },
                errorHandler: () => 'recoverable' as const,
              },
            }),
            createPlugin('downstream', {boot: downstream}),
          ],
        });

        const result = container.pipeSync({hook: 'boot', args: [{name: 'test'}]});

        expect(result).toBe('continued');
        expect(downstream).toHaveBeenCalledTimes(1);
      });

      it('does not swallow nullish downstream throws during synchronous recovery', () => {
        const container = buildContainer({
          plugins: [
            createPlugin('recoverable', {
              boot: {
                handler: ({next}: any) => next(),
                errorHandler: () => 'recoverable' as const,
              },
            }),
            createPlugin('downstream', {
              boot: () => {
                throw undefined;
              },
            }),
          ],
        });
        let didThrow = false;

        try {
          container.pipeSync({hook: 'boot', args: [{name: 'test'}]});
        } catch {
          didThrow = true;
        }

        expect(didThrow).toBe(true);
      });

      it('uses a synchronous terminal and rejects repeated continuation calls', () => {
        const terminalContainer = buildContainer();
        expect(
          terminalContainer.pipeSync({
            hook: 'boot',
            args: [{name: 'test'}],
            terminal: ({name}) => `terminal:${name}`,
          }),
        ).toBe('terminal:test');

        const repeatedContainer = buildContainer({
          plugins: [
            createPlugin('alpha', {
              boot: ({next}: any) => {
                next();
                return next();
              },
            }),
          ],
        });
        expect(() =>
          repeatedContainer.pipeSync({
            hook: 'boot',
            args: [{name: 'test'}],
            terminal: () => 'done',
          }),
        ).toThrow();
      });
    });

    describe('plugin metadata', () => {
      it('ignores enumerable non-hook properties during normalization', () => {
        const plugin = createPlugin('metadata', {
          setup: vi.fn(),
          wire: {protocol: 'wire-1'},
        });
        const container = buildContainer({plugins: [plugin]});

        expect((container as any).has('wire')).toBe(false);
        expect(() => container.sequentialSync({hook: 'setup', args: []})).not.toThrow();
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
