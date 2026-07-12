import type {
  Executable,
  ExecutableOptions,
  KernelLifecycles,
} from '@ai.assistant/contracts/executable';
import type {Plugin} from '@ai.assistant/contracts/plugins';
import {describe, expect, expectTypeOf, it, vi} from 'vitest';

/** Factories required by the shared executable compliance suite. */
export interface ExecutableComplianceTestSuite {
  /** Construct a fresh executable at `created` state. */
  createExecutable: (options?: ExecutableOptions) => Executable;
}

/**
 * Register the lifecycle, orchestration, error, rendering, concurrency, and
 * fork tests every executable implementation must satisfy.
 *
 * @param factories - Implementation constructors exposed through contracts.
 */
export function runExecutableComplianceTests(factories: ExecutableComplianceTestSuite): void {
  const {createExecutable} = factories;

  describe('executable compliance', () => {
    describe('construction and lifecycle', () => {
      it('starts at created state without invoking lifecycle behavior', () => {
        const create = vi.fn();
        const executable = createExecutable({lifecycles: {create}});

        expect(executable.status).toBe('created');
        expect(executable.error).toBeNull();
        expect(create).not.toHaveBeenCalled();
      });

      it('initializes through observable transitional states', async () => {
        const states: string[] = [];
        const executable = createExecutable({
          lifecycles: {
            create() {
              states.push(this.status);
            },
            initialize() {
              states.push(this.status);
            },
          },
        });

        const result = await executable.initialize();

        expect(result).toBe(executable);
        expect(states).toEqual(['creating', 'initializing']);
        expect(executable.status).toBe('initialized');
      });

      it('auto-initializes during activation and supports reactivation', async () => {
        const activate = vi.fn();
        const executable = createExecutable({lifecycles: {activate}});

        await executable.activate();
        await executable.deactivate();
        await executable.activate();

        expect(executable.status).toBe('active');
        expect(activate).toHaveBeenCalledTimes(2);
      });

      it('treats ineligible nonterminal transitions as no-ops', async () => {
        const deactivate = vi.fn();
        const executable = createExecutable({lifecycles: {deactivate}});

        await executable.deactivate();
        await executable.initialize();
        await executable.deactivate();

        expect(executable.status).toBe('initialized');
        expect(deactivate).not.toHaveBeenCalled();
      });

      it('deactivates an active scope before disposal', async () => {
        const order: string[] = [];
        const executable = createExecutable({
          lifecycles: {
            deactivate() {
              order.push('deactivate');
            },
            dispose() {
              order.push('dispose');
            },
          },
        });
        await executable.activate();

        const result = await executable.dispose();

        expect(result).toBe(executable);
        expect(order).toEqual(['deactivate', 'dispose']);
        expect(executable.status).toBe('disposed');
      });

      it('rejects lifecycle control after disposal', async () => {
        const executable = createExecutable();
        await executable.dispose();

        await expect(executable.dispose()).rejects.toThrow(/already-disposed executable/);
        await expect(executable.initialize()).rejects.toThrow();
        await expect(executable.activate()).rejects.toThrow();
        await expect(executable.deactivate()).rejects.toThrow();
      });
    });

    describe('orchestration', () => {
      it('runs specialization callbacks before the kernel', async () => {
        const order: string[] = [];
        const executable = createExecutable({
          lifecycles: {
            create() {
              order.push('callback:create');
            },
            initialize() {
              order.push('callback:initialize');
            },
          },
          kernel: lifecyclePlugin('kernel', {
            create() {
              order.push('kernel:create');
            },
            initialize() {
              order.push('kernel:initialize');
            },
          }),
        });

        await executable.initialize();

        expect(order).toEqual([
          'callback:create',
          'kernel:create',
          'callback:initialize',
          'kernel:initialize',
        ]);
      });

      it('does not invoke inherited plugins without specialization callbacks', async () => {
        const create = vi.fn();
        const executable = createExecutable({
          plugins: [lifecyclePlugin('provider', {create})],
        });

        await executable.initialize();

        expect(create).not.toHaveBeenCalled();
      });

      it('binds lifecycle callbacks to the executable', async () => {
        let received: Executable | undefined;
        const executable = createExecutable({
          lifecycles: {
            create() {
              received = this;
            },
          },
        });

        await executable.initialize();

        expect(received).toBe(executable);
        expectTypeOf(received).toEqualTypeOf<Executable | undefined>();
      });
    });

    describe('renderable composition', () => {
      it('composes specialization and kernel layers in order', async () => {
        const executable = createExecutable({
          renderable: 1,
          lifecycles: {
            renderable(children) {
              expect(children).toBe(1);
              return 2;
            },
          },
          kernel: lifecyclePlugin('kernel', {
            ui({children}) {
              expect(children).toBe(2);
              return 3;
            },
          }),
        });

        await executable.initialize();

        expect(executable.ui.value).toBe(3);
      });

      it('retains a nullish renderable returned by a composition layer', async () => {
        const executable = createExecutable({
          renderable: 'base',
          kernel: lifecyclePlugin('kernel', {ui: () => undefined}),
        });

        await executable.initialize();

        expect(executable.ui.value).toBeUndefined();
      });
    });

    describe('events and errors', () => {
      it('emits lifecycle events after settled state is visible', async () => {
        const states: string[] = [];
        const executable = createExecutable();
        executable.on('executable:initialized', () => states.push(executable.status));
        executable.on('executable:activated', () => states.push(executable.status));
        executable.on('executable:deactivated', () => states.push(executable.status));

        await executable.activate();
        await executable.deactivate();

        expect(states).toEqual(['initialized', 'active', 'inactive']);
      });

      it('normalizes failures and runs error handlers before entering error state', async () => {
        const observations: string[] = [];
        const executable = createExecutable({
          lifecycles: {
            create() {
              throw new Error('creation failed');
            },
            error(error) {
              observations.push(`callback:${this.status}:${error.message}`);
            },
          },
          kernel: lifecyclePlugin('kernel', {
            error(error) {
              observations.push(`kernel:${executable.status}:${error.message}`);
            },
          }),
        });
        executable.on('executable:errored', (event) => {
          observations.push(`event:${executable.status}:${event.details.message}`);
        });

        await expect(executable.initialize()).rejects.toThrow('creation failed');

        expect(executable.status).toBe('error');
        expect(executable.error?.message).toBe('creation failed');
        expect(observations).toEqual([
          'callback:creating:creation failed',
          'kernel:creating:creation failed',
          'event:error:creation failed',
        ]);
      });

      it('preserves the original failure when error handlers throw', async () => {
        const executable = createExecutable({
          lifecycles: {
            create() {
              throw new Error('primary');
            },
            error() {
              throw new Error('secondary');
            },
          },
        });

        await expect(executable.initialize()).rejects.toThrow('primary');
      });
    });

    describe('concurrency', () => {
      it('coalesces concurrent calls for the same transition', async () => {
        const create = vi.fn();
        const activate = vi.fn();
        const executable = createExecutable({lifecycles: {create, activate}});

        await Promise.all([executable.activate(), executable.activate(), executable.activate()]);

        expect(create).toHaveBeenCalledOnce();
        expect(activate).toHaveBeenCalledOnce();
        expect(executable.status).toBe('active');
      });

      it('gives a pending disposal priority over new activation work', async () => {
        const activate = vi.fn();
        const executable = createExecutable({lifecycles: {activate}});
        await executable.initialize();

        await Promise.all([executable.activate(), executable.dispose()]);

        expect(activate).not.toHaveBeenCalled();
        expect(executable.status).toBe('disposed');
      });
    });
  });
}

/** Build a lifecycle plugin with a typed hook map. */
function lifecyclePlugin(
  name: string,
  hooks: Partial<Plugin<KernelLifecycles>> = {},
): Plugin<KernelLifecycles> {
  return {name, ...hooks};
}
