import type {
  Application as ApplicationContract,
  ServiceProvider,
  ServiceProviderLifecycles,
} from '@ai.assistant/contracts/application';
import type {IntentDefinition, IntentQuery} from '@ai.assistant/contracts/intents';
import type {Kernel} from '@ai.assistant/contracts/executable';
import {Executable} from '@ai.assistant/executable';
import {describe, expect, it, vi} from 'vitest';
import {INTENT_REGISTRY_IDENTIFIER} from '../../constants';
import {IntentRegistry} from '../IntentRegistry';

function kernel(name = 'test-kernel'): Kernel {
  return {name};
}

function definition(overrides: Partial<IntentDefinition> = {}): IntentDefinition {
  return {
    action: 'create',
    mimeType: 'application/vnd.ai.assistant.thing',
    scope: 'main',
    kernel: 'test-kernel',
    handler: vi.fn(),
    ...overrides,
  };
}

function registry(serviceProviders: ServiceProvider[] = []): IntentRegistry {
  const app = new Executable<ServiceProviderLifecycles>({plugins: serviceProviders});
  return new IntentRegistry({
    app: app as Executable<ServiceProviderLifecycles> & ApplicationContract,
    pluginContainer: app.pluginContainer,
    scopes: [{scope: 'main', kernels: [kernel()], serviceProviders}],
  });
}

describe('IntentRegistry', () => {
  it('constructs an empty branded registry', () => {
    const intents = registry();

    expect(intents[INTENT_REGISTRY_IDENTIFIER]).toBe(true);
    expect(intents.isEmpty).toBe(true);
    expect(intents.size).toBe(0);
  });

  it('registers and deduplicates intents by immutable identity', () => {
    const intents = registry();
    const first = intents.register(definition({name: 'First'}));
    const second = intents.register(definition({name: 'Updated'}));

    expect(second).toBe(first);
    expect(second.name).toBe('Updated');
    expect(intents.size).toBe(1);
  });

  it('rejects definitions without a declared scope template', () => {
    const intents = registry();

    expect(() => intents.register(definition({kernel: 'missing'}))).toThrow(
      'Unknown scope+kernel combination',
    );
  });

  it('resolves object and URI queries synchronously', () => {
    const intents = registry();
    const intent = intents.register(definition());

    expect(intents.get({action: 'create'})).toBe(intent);
    expect(intents.get('create:application/vnd.ai.assistant.thing')).toBe(intent);
    expect(intents.getAll({mimeType: intent.mimeType})).toEqual([intent]);
  });

  it('lets synchronous match hooks veto immutable matches', () => {
    const match = vi.fn((_query: IntentQuery) => false);
    const intents = registry([{name: 'matcher', match}]);
    intents.register(definition());

    expect(intents.get({action: 'create'})).toBeUndefined();
    expect(match).toHaveBeenCalledOnce();
  });

  it('registers definitions contributed by asynchronous resolution hooks', async () => {
    const resolve = vi.fn(() => [definition({action: 'lazy'})]);
    const intents = registry([{name: 'resolver', resolve}]);

    await expect(intents.resolve({action: 'lazy'})).resolves.toMatchObject({action: 'lazy'});
    expect(resolve).toHaveBeenCalledOnce();
  });

  it('uses priority before provider disambiguation', async () => {
    const intents = registry();
    intents.register(definition({mimeType: 'text/plain', priority: 1}));
    intents.register(definition({mimeType: 'text/html', priority: 2}));

    const activity = await intents.invoke({action: 'create'});

    expect(activity.intent.mimeType).toBe('text/html');
  });

  it('creates active activities and removes root tracking on disposal', async () => {
    const intents = registry();
    intents.register(definition({mode: 'detached'}));

    const activity = await intents.invoke({action: 'create'});
    expect(activity.status).toBe('active');
    expect(intents.activities).toContain(activity);

    await activity.dispose();
    expect(intents.activities).not.toContain(activity);
  });

  it('merges explicit invocation options with URI input', async () => {
    const handler = vi.fn();
    const intents = registry();
    intents.register(definition({handler, mode: 'detached'}));

    const activity = await intents.invoke('create:application/vnd.ai.assistant.thing?from=uri', {
      input: {from: 'options'},
    });

    expect(activity.input).toEqual({from: 'options'});
  });
});
