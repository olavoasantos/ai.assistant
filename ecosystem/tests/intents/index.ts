import type {ServiceProvider} from '@ai.assistant/contracts/application';
import type {
  ActivityResponse,
  IntentDefinition,
  IntentRegistry,
  IntentSystemOptions,
} from '@ai.assistant/contracts/intents';
import type {Kernel} from '@ai.assistant/contracts/executable';
import {describe, expect, it, vi} from 'vitest';

/** Factories required by the shared intents compliance suite. */
export interface IntentsComplianceTestSuite {
  /** Construct a registry with the supplied root intent configuration. */
  createRegistry(options?: IntentSystemOptions, providers?: ServiceProvider[]): IntentRegistry;
}

/**
 * Register the behavior every intent system implementation must satisfy.
 *
 * @param factories - Implementation constructors exposed through contracts.
 */
export function runIntentsComplianceTests(factories: IntentsComplianceTestSuite): void {
  describe('intents compliance', () => {
    it('registers definitions only for declared scope templates', () => {
      const registry = factories.createRegistry(configuration());
      const intent = registry.register(definition());

      expect(intent.action).toBe('run');
      expect(registry.size).toBe(1);
      expect(() => registry.register(definition({kernel: 'missing'}))).toThrow();
    });

    it('deduplicates immutable identity and updates mutable fields', () => {
      const registry = factories.createRegistry(configuration());
      const first = registry.register(definition({name: 'First'}));
      const second = registry.register(definition({name: 'Second'}));

      expect(second).toBe(first);
      expect(second.name).toBe('Second');
      expect(registry.size).toBe(1);
    });

    it('supports synchronous and lazy asynchronous resolution', async () => {
      const lazy = definition({action: 'lazy'});
      const resolve = vi.fn(() => [lazy]);
      const registry = factories.createRegistry(configuration(), [{name: 'resolver', resolve}]);
      registry.register(definition());

      expect(registry.get({action: 'run'})).toBeDefined();
      expect(registry.get({action: 'lazy'})).toBeUndefined();
      await expect(registry.resolve({action: 'lazy'})).resolves.toMatchObject({action: 'lazy'});
    });

    it('lets match hooks veto but not expand immutable matches', () => {
      const match = vi.fn(() => false);
      const registry = factories.createRegistry(configuration(), [{name: 'matcher', match}]);
      registry.register(definition());

      expect(registry.get({action: 'run'})).toBeUndefined();
      expect(registry.get({action: 'other'})).toBeUndefined();
    });

    it('selects the unique highest-priority match', async () => {
      const registry = factories.createRegistry(configuration());
      registry.register(definition({mimeType: 'text/plain', priority: 1}));
      registry.register(definition({mimeType: 'text/html', priority: 2}));

      const activity = await registry.invoke({action: 'run'});

      expect(activity.intent.mimeType).toBe('text/html');
    });

    it('invokes activity hooks instead of ordinary provider hooks', async () => {
      const initialize = vi.fn();
      const initializeActivity = vi.fn();
      const registry = factories.createRegistry(configuration(), [
        {name: 'provider', initialize, initializeActivity},
      ]);
      registry.register(definition({mode: 'detached'}));

      await registry.invoke({action: 'run'});

      expect(initialize).not.toHaveBeenCalled();
      expect(initializeActivity).toHaveBeenCalledOnce();
    });

    it('supports awaitable responses without rejecting application errors', async () => {
      const registry = factories.createRegistry(configuration());
      registry.register(
        definition({
          handler({activity}) {
            activity.respond.success('complete');
          },
        }),
      );

      const activity = await registry.invoke({action: 'run'});
      const response = await (activity.response as Promise<ActivityResponse<string>>);

      expect(response).toEqual({status: 'success', data: 'complete'});
    });

    it('tracks nested activities and removes disposed activities', async () => {
      const registry = factories.createRegistry(configuration());
      registry.register(definition({mode: 'detached'}));
      const parent = await registry.invoke({action: 'run'});
      const child = await parent.intents.invoke({action: 'run'});

      expect(child.parent).toBe(parent);
      expect(parent.children).toContain(child);

      await child.dispose();
      expect(parent.children).not.toContain(child);
      expect(child.intent.activities).not.toContain(child);
    });
  });
}

function configuration(): IntentSystemOptions {
  const kernel: Kernel = {name: 'kernel'};
  return {scopes: [{scope: 'main', kernels: [kernel]}]};
}

function definition(overrides: Partial<IntentDefinition> = {}): IntentDefinition {
  return {
    action: 'run',
    mimeType: 'application/vnd.ai.assistant.task',
    scope: 'main',
    kernel: 'kernel',
    handler: vi.fn(),
    ...overrides,
  };
}
