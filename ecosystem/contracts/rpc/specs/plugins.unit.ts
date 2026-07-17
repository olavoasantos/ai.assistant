import {describe, expectTypeOf, it} from 'vitest';
import type {PluginContainer} from '../../plugins';
import type {
  RpcCoreResourceObservationFact,
  RpcHydratedValue,
  RpcIncomingOperationContext,
  RpcObserveContext,
  RpcOperationOutcome,
  RpcPlugin,
  RpcPluginHooks,
  RpcPluginResourceObservationFact,
  RpcRemote,
  RpcSerializedValue,
  RpcSerializeValueContext,
  RpcSetupSessionContext,
  RpcWirePluginCompatibility,
} from '..';

interface TestSignal<Value> {
  readonly value: Value;
  subscribe(listener: (value: Value) => void): () => void;
}

interface TestRemoteSignal<Value> {
  readonly value: Value;
  subscribe(listener: (value: Value) => void): () => void;
}

declare module '..' {
  interface RpcValueProjections<_Value> {
    readonly signal: _Value extends TestSignal<infer Value>
      ? TestRemoteSignal<RpcRemote<Value>>
      : never;
  }
}

const objectPlugin: RpcPlugin<'rpc-core-object'> = {
  name: 'rpc-core-object',
  wire: {
    id: 'rpc.core.object',
    protocols: ['object-1'],
    requirement: 'required',
    valueNamespaces: ['reference'],
    messageNamespaces: ['release'],
  },
  serializeValue(context) {
    if (typeof context.value !== 'object' || context.value == null) return undefined;
    return context.issueReference(context.value, {
      kind: 'object',
      namespace: 'reference',
      payload: {},
    });
  },
};

const functionPlugin: RpcPlugin<'rpc-core-function'> = {
  name: 'rpc-core-function',
  wire: {
    id: 'rpc.core.function',
    protocols: ['function-1'],
    requirement: 'required',
    valueNamespaces: ['function'],
    messageNamespaces: ['call', 'release'],
  },
  serializeValue(context) {
    if (typeof context.value !== 'function') return undefined;
    return context.issueReference(context.value, {
      kind: 'function',
      namespace: 'function',
      payload: {},
    });
  },
};

const promisePlugin: RpcPlugin<'rpc-core-promise'> = {
  name: 'rpc-core-promise',
  wire: {
    id: 'rpc.core.promise',
    protocols: ['promise-1'],
    requirement: 'required',
    valueNamespaces: ['promise'],
    messageNamespaces: ['resolve', 'reject', 'cancel'],
  },
  serializeValue(context) {
    if (typeof context.value !== 'object' || context.value == null || !('then' in context.value)) {
      return undefined;
    }
    return context.issueReference(context.value, {
      kind: 'promise',
      namespace: 'promise',
      payload: {},
    });
  },
};

const signalsPlugin: RpcPlugin<'preact-signals', 'signals.cached' | 'updates.bytes'> = {
  name: 'preact-signals',
  wire: {
    id: 'ai.assistant.preact-signals',
    protocols: ['signals-2', 'signals-1'],
    requirement: 'optional',
    valueNamespaces: ['signal'],
    messageNamespaces: ['watch', 'unwatch', 'update'],
  },
  resources: [
    {category: 'signals.cached', unit: 'count', mode: 'capacity'},
    {category: 'updates.bytes', unit: 'bytes', mode: 'capacity'},
  ],
  setupSession(context) {
    const result = context.budget.reserve({
      entries: 1,
      categories: [{category: 'signals.cached', amount: 1}],
    });
    if (!result.ok) return;
    result.reservation.release();
  },
  serializeValue(context) {
    if (
      typeof context.value !== 'object' ||
      context.value == null ||
      !('subscribe' in context.value)
    ) {
      return undefined;
    }
    return context.issueReference(context.value, {
      kind: 'plugin',
      namespace: 'signal',
      payload: context.serialize((context.value as TestSignal<unknown>).value),
    });
  },
  hydrateValue(context) {
    if (context.serialized.plugin !== 'ai.assistant.preact-signals') return undefined;
    return {
      value: context.hydrateReference(context.serialized, {
        create: () => ({
          value: context.hydrate(context.serialized.payload),
          apply: (_value: unknown) => undefined,
          subscribe: () => {
            void context.send({
              plugin: 'ai.assistant.preact-signals',
              namespace: 'watch',
              action: 'start',
              payload: {},
            });
            return () => {
              void context.send({
                plugin: 'ai.assistant.preact-signals',
                namespace: 'unwatch',
                action: 'stop',
                payload: {},
              });
            };
          },
        }),
      }),
    };
  },
  controlValue(context) {
    if (context.operation.plugin !== 'ai.assistant.preact-signals') return undefined;
    const signal = context.resolveReference() as {apply(value: unknown): void} | undefined;
    signal?.apply(context.hydrate(context.operation.payload));
    return {handled: true};
  },
};

const contextualPlugin: RpcPlugin<'contextual-plugin'> = {
  name: 'contextual-plugin',
  setupEndpoint() {
    const name: 'contextual-plugin' = this.name;
    void name;
    void this.store;
    void this.telemetry;
    // @ts-expect-error generic plugin context does not expose the mutable RPC session
    void this.session;
  },
};

const localObserver: RpcPlugin<'local-observer'> = {
  name: 'local-observer',
  observe: () => undefined,
};

const mixedPlugin: RpcPlugin<'mixed-plugin'> = {
  name: 'mixed-plugin',
  wire: {
    id: 'example.mixed',
    protocols: ['mixed-1'],
    requirement: 'optional',
    valueNamespaces: ['value'],
  },
  serializeValue: () => undefined,
  observe: () => undefined,
};

function exerciseLeastCapability(context: RpcSerializeValueContext): void {
  context.serialize(context.value);
  // @ts-expect-error serialization hooks cannot access the mutable session
  void context.session;
  // @ts-expect-error serialization hooks cannot send arbitrary frames
  void context.sendFrame;
}

function exerciseExecutionStrategies(
  container: PluginContainer<RpcPluginHooks>,
  incoming: Omit<RpcIncomingOperationContext, 'next'>,
  serialization: RpcSerializeValueContext,
  observation: RpcObserveContext,
): void {
  container.direct({
    hook: 'serializeValue',
    execute: (executor) => executor.first([serialization]),
  });
  void container.pipe({
    hook: 'incomingOperation',
    args: [incoming],
    terminal: async (): Promise<RpcOperationOutcome> => ({
      status: 'success',
      value: undefined,
    }),
  });
  void container.observe({hook: 'observe', args: [observation]});
}

function exerciseSessionBudget(context: RpcSetupSessionContext<'state'>): void {
  context.budget.reserve({entries: 1, categories: [{category: 'state', amount: 1}]});
  void context.budget.resources;
  // @ts-expect-error plugin budgets do not expose mutable core counters
  void context.budget.core;
  // @ts-expect-error session setup does not expose the mutable RPC session
  void context.session;
}

function exerciseSignalsBudget(
  context: RpcSetupSessionContext<'signals.cached' | 'updates.bytes'>,
): void {
  context.budget.reserve({
    entries: 1,
    categories: [{category: 'signals.cached', amount: 1}],
  });
  // @ts-expect-error setup budgets accept only declared plugin categories
  context.budget.reserve({entries: 1, categories: [{category: 'state', amount: 1}]});
}

function inspectResourceFact(
  fact: RpcCoreResourceObservationFact | RpcPluginResourceObservationFact,
): void {
  if (fact.owner === 'core') {
    expectTypeOf(fact.category).toEqualTypeOf<
      | 'frame.bytes'
      | 'payload.bytes'
      | 'decode.depth'
      | 'decode.entries'
      | 'calls.pending'
      | 'notifications.pending'
      | 'references.object.issued'
      | 'references.object.received'
      | 'references.function.issued'
      | 'references.function.received'
      | 'references.promise.issued'
      | 'references.promise.received'
      | 'references.stream.issued'
      | 'references.stream.received'
      | 'references.plugin.issued'
      | 'references.plugin.received'
      | 'promises.pending'
      | 'streams.active'
      | 'streams.buffered.items'
      | 'streams.buffered.bytes'
      | 'watches.active'
      | 'updates.queued'
      | 'transferables.active'
      | 'plugins.messages.pending'
      | 'plugins.state'
    >();
    if (fact.category === 'frame.bytes') {
      expectTypeOf(fact.observation.unit).toEqualTypeOf<'bytes'>();
      expectTypeOf(fact.observation.mode).toEqualTypeOf<'maximum'>();
    }
    // @ts-expect-error core facts have no plugin qualifier
    void fact.plugin;
    return;
  }

  expectTypeOf(fact.plugin).toEqualTypeOf<string>();
  expectTypeOf(fact.category).toEqualTypeOf<string>();
}

function mutateCompatibility(selection: RpcWirePluginCompatibility): void {
  // @ts-expect-error negotiated plugin identity is immutable
  selection.id = 'changed';
  // @ts-expect-error negotiated namespace arrays are read-only
  selection.valueNamespaces.push('changed');
}

describe('RPC plugin contracts', () => {
  it('express core reference values as mandatory ordinary plugins', () => {
    expectTypeOf(objectPlugin).toExtend<RpcPlugin>();
    expectTypeOf(functionPlugin).toExtend<RpcPlugin>();
    expectTypeOf(promisePlugin).toExtend<RpcPlugin>();
    expectTypeOf(objectPlugin.wire?.requirement).toEqualTypeOf<
      'required' | 'optional' | undefined
    >();
  });

  it('express a Signals wire plugin without another execution framework', () => {
    expectTypeOf(signalsPlugin).toExtend<RpcPlugin>();
    expectTypeOf<RpcRemote<TestSignal<{name: string}>>>().toEqualTypeOf<
      TestRemoteSignal<{readonly name: string}>
    >();
  });

  it('allows local-only and mixed plugins through the same authoring shape', () => {
    expectTypeOf(localObserver.wire).toEqualTypeOf<
      | {
          readonly id: string;
          readonly protocols: readonly [string, ...string[]];
          readonly requirement: 'required' | 'optional';
          readonly valueNamespaces?: readonly string[];
          readonly messageNamespaces?: readonly string[];
        }
      | undefined
    >();
    expectTypeOf(mixedPlugin).toExtend<RpcPlugin>();
  });

  it('keeps successful serialization distinct from passing', () => {
    expectTypeOf<
      ReturnType<RpcPluginHooks['serializeValue']>
    >().toEqualTypeOf<RpcSerializedValue | void>();
  });

  it('wraps hydrated undefined as a successful result', () => {
    const result: RpcHydratedValue<undefined> = {value: undefined};

    expectTypeOf(result.value).toEqualTypeOf<undefined>();
  });

  it('exposes least-capability hook inputs and matching PluginEngine strategies', () => {
    expectTypeOf(contextualPlugin).toExtend<RpcPlugin>();
    expectTypeOf(exerciseLeastCapability).toBeFunction();
    expectTypeOf(exerciseExecutionStrategies).toBeFunction();
    expectTypeOf<ReturnType<RpcPluginHooks['incomingOperation']>>().toEqualTypeOf<
      Promise<RpcOperationOutcome>
    >();
    expectTypeOf<ReturnType<RpcPluginHooks['observe']>>().toEqualTypeOf<void | Promise<void>>();
  });

  it('scopes declared plugin resources without exposing the core ledger', () => {
    expectTypeOf(signalsPlugin.resources).toEqualTypeOf<
      | readonly {
          readonly category: 'signals.cached' | 'updates.bytes';
          readonly unit: 'bytes' | 'count' | 'depth';
          readonly mode: 'capacity';
        }[]
      | undefined
    >();
    expectTypeOf(exerciseSessionBudget).toBeFunction();
    expectTypeOf(exerciseSignalsBudget).toBeFunction();
    expectTypeOf(inspectResourceFact).toBeFunction();
  });

  it('keeps negotiated compatibility observations immutable', () => {
    expectTypeOf(mutateCompatibility).toBeFunction();
  });
});
