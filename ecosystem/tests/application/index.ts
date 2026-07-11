import type {
  Application,
  ApplicationOptions,
  Kernel,
  ServiceProvider,
} from '@ai.assistant/contracts/application';
import type {HookContext} from '@ai.assistant/contracts/plugins';
import {describe, expect, it, vi} from 'vitest';

/** Factories required by the shared application compliance suite. */
export interface ApplicationComplianceTestSuite {
  /** Construct a fresh application at `created` state. */
  createApplication: (options?: ApplicationOptions) => Application;
}

/**
 * Register the application-specific tests every implementation must satisfy.
 *
 * Executable lifecycle guarantees are inherited by contract. This suite pins
 * the application specialization: scope defaults, provider orchestration,
 * rendering, context, factories, and subtype-preserving forks.
 *
 * @param factories - Implementation constructors exposed through contracts.
 */
export function runApplicationComplianceTests(factories: ApplicationComplianceTestSuite): void {
  const {createApplication} = factories;

  describe('application compliance', () => {
    it('constructs inertly with the application root scope', () => {
      const create = vi.fn();
      const application = createApplication({
        serviceProviders: [provider('inert', {create})],
      });

      expect(application.status).toBe('created');
      expect(application.scope).toBe('app');
      expect(create).not.toHaveBeenCalled();
    });

    it('runs each provider lifecycle hook exactly once', async () => {
      const hooks = {
        create: vi.fn(),
        initialize: vi.fn(),
        activate: vi.fn(),
        deactivate: vi.fn(),
        dispose: vi.fn(),
      };
      const application = createApplication({
        serviceProviders: [provider('lifecycle', hooks)],
      });

      await application.activate();
      await application.deactivate();
      await application.dispose();

      for (const hook of Object.values(hooks)) {
        expect(hook).toHaveBeenCalledOnce();
      }
    });

    it('runs providers before the kernel in registration order after creation', async () => {
      const order: string[] = [];
      const application = createApplication({
        serviceProviders: [
          provider('first', {
            initialize() {
              order.push('first');
            },
          }),
          provider('second', {
            initialize() {
              order.push('second');
            },
          }),
        ],
        kernel: kernel('kernel', {
          initialize() {
            order.push('kernel');
          },
        }),
      });

      await application.initialize();

      expect(order).toEqual(['first', 'second', 'kernel']);
    });

    it('composes provider renderables inside the kernel renderable', async () => {
      const providerUi = vi.fn(() => 'provider');
      const kernelUi = vi.fn(() => 'kernel');
      const application = createApplication({
        renderable: 'base',
        serviceProviders: [provider('provider', {ui: providerUi})],
        kernel: kernel('kernel', {ui: kernelUi}),
      });

      await application.initialize();

      expect(providerUi).toHaveBeenCalledWith({children: 'base'});
      expect(kernelUi).toHaveBeenCalledWith({children: 'provider'});
      expect(application.ui.value).toBe('kernel');
    });

    it('provides the service container to provider hooks', async () => {
      let received: unknown;
      const application = createApplication({
        serviceProviders: [
          {
            name: 'context',
            create() {
              received = (this as HookContext & {container: unknown}).container;
            },
          },
        ],
      });

      await application.initialize();

      expect(received).toBe(application.container);
    });

    it('forks application children with inherited and additional providers', async () => {
      const inherited = vi.fn();
      const additional = vi.fn();
      const parent = createApplication({
        serviceProviders: [provider('inherited', {create: inherited})],
      });
      const child = parent.fork({
        serviceProviders: [provider('additional', {create: additional})],
      });

      await child.initialize();

      expect(child.scope).toBe('child');
      expect(child.status).toBe('initialized');
      expect(child.pluginContainer.size).toBe(2);
      expect(inherited).toHaveBeenCalledOnce();
      expect(additional).toHaveBeenCalledOnce();
    });
  });
}

function provider(name: string, hooks: Omit<ServiceProvider, 'name'> = {}): ServiceProvider {
  return {name, ...hooks};
}

function kernel(name: string, hooks: Omit<Kernel, 'name'> = {}): Kernel {
  return {name, ...hooks};
}
