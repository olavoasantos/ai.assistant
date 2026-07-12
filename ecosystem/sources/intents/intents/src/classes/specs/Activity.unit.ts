import type {
  Application as ApplicationContract,
  ServiceProvider,
  ServiceProviderLifecycles,
} from '@ai.assistant/contracts/application';
import type {IntentDefinition} from '@ai.assistant/contracts/intents';
import type {Kernel} from '@ai.assistant/contracts/executable';
import {Executable} from '@ai.assistant/executable';
import {describe, expect, it, vi} from 'vitest';
import {ACTIVITY_IDENTIFIER} from '../../constants';
import {IntentRegistry} from '../IntentRegistry';

function createRegistry(provider?: ServiceProvider): IntentRegistry {
  const providers = provider ? [provider] : [];
  const app = new Executable<ServiceProviderLifecycles>({plugins: providers});
  const kernel: Kernel = {name: 'kernel'};
  return new IntentRegistry({
    app: app as Executable<ServiceProviderLifecycles> & ApplicationContract,
    pluginContainer: app.pluginContainer,
    scopes: [{scope: 'main', kernels: [kernel]}],
  });
}

function register(registry: IntentRegistry, overrides: Partial<IntentDefinition> = {}): void {
  registry.register({
    action: 'run',
    mimeType: 'application/vnd.ai.assistant.task',
    scope: 'main',
    kernel: 'kernel',
    handler: vi.fn(),
    mode: 'detached',
    ...overrides,
  });
}

describe('Activity', () => {
  it('is branded and active after invocation', async () => {
    const intents = createRegistry();
    register(intents);

    const activity = await intents.invoke({action: 'run'});

    expect(activity[ACTIVITY_IDENTIFIER]).toBe(true);
    expect(activity.status).toBe('active');
    expect(activity.parent).toBeUndefined();
  });

  it('invokes activity hooks without invoking ordinary provider hooks', async () => {
    const initialize = vi.fn();
    const initializeActivity = vi.fn();
    const intents = createRegistry({name: 'provider', initialize, initializeActivity});
    register(intents);

    await intents.invoke({action: 'run'});

    expect(initialize).not.toHaveBeenCalled();
    expect(initializeActivity).toHaveBeenCalledOnce();
  });

  it('invokes ordinary kernel hooks for an activity', async () => {
    const activate = vi.fn();
    const app = new Executable<ServiceProviderLifecycles>();
    const intents = new IntentRegistry({
      app: app as Executable<ServiceProviderLifecycles> & ApplicationContract,
      pluginContainer: app.pluginContainer,
      scopes: [{scope: 'main', kernels: [{name: 'kernel', activate}]}],
    });
    register(intents);

    await intents.invoke({action: 'run'});

    expect(activate).toHaveBeenCalledOnce();
  });

  it('validates input before executing the handler', async () => {
    const handler = vi.fn();
    const ensureParse = vi.fn(() => ({validated: true}));
    const intents = createRegistry();
    register(intents, {
      mode: 'awaitable',
      handler: ({input, activity}) => {
        handler(input);
        activity.respond.success('done');
      },
      inputSchema: {ensureParse} as unknown as IntentDefinition['inputSchema'],
    });

    const activity = await intents.invoke({action: 'run', input: {raw: true}});
    await activity.response;

    expect(ensureParse).toHaveBeenCalledWith({raw: true});
    expect(handler).toHaveBeenCalledWith({validated: true});
  });

  it('creates nested activities through the activity-scoped registry', async () => {
    const intents = createRegistry();
    register(intents);
    const parent = await intents.invoke({action: 'run'});

    const child = await parent.intents.invoke({action: 'run'});

    expect(child.parent).toBe(parent);
    expect(parent.children).toContain(child);
  });

  it('removes itself from intent and parent tracking on disposal', async () => {
    const intents = createRegistry();
    register(intents);
    const parent = await intents.invoke({action: 'run'});
    const child = await parent.intents.invoke({action: 'run'});

    await child.dispose();

    expect(parent.children).not.toContain(child);
    expect(child.intent.activities).not.toContain(child);
  });
});
