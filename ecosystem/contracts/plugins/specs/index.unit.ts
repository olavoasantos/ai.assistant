import {describe, expectTypeOf, it} from 'vitest';
import type {
  ExecutionStrategy,
  Plugin,
  PluginContainer,
  PluginContinuation,
  ReadonlyPluginContainer,
} from '..';

interface ContractHookMap {
  asyncWork(): Promise<void>;
  callableMiddleware(context: (() => void) & PluginContinuation<string>): string;
  inspect(value: unknown): string | void;
  middleware(
    context: {readonly value: string} & PluginContinuation<Promise<string>>,
  ): Promise<string>;
  observe(event: {readonly kind: string}): void;
}

interface ContractPluginMetadata {
  readonly wire?: {
    readonly protocol: string;
  };
}

type ContractPlugin = Plugin<ContractHookMap, 'contract-plugin', ContractPluginMetadata>;

function exerciseContainerContract(
  container: PluginContainer<ContractHookMap>,
  plugin: ContractPlugin,
): void {
  container.protect(plugin).add({name: 'local'});

  void container.pipe({
    hook: 'middleware',
    args: [{value: 'input'}],
    terminal: async ({value}) => value,
  });

  // @ts-expect-error the continuation is injected by the engine
  void container.pipe({hook: 'middleware', args: [{value: 'input', next: async () => 'next'}]});

  void container.observe({hook: 'observe', args: [{kind: 'operation'}]});
  container.observeSync({hook: 'observe', args: [{kind: 'operation'}]});

  // @ts-expect-error callable first arguments cannot receive an injected continuation
  void container.pipe({hook: 'callableMiddleware', args: []});

  // @ts-expect-error direct execution only accepts entirely synchronous hooks
  container.direct({hook: 'asyncWork', execute: (executor) => executor.sequential([])});

  const result = container.direct({
    hook: 'inspect',
    execute(executor) {
      executor.sequential([0]);
      const first = executor.first([1]);
      return executor.reduce({
        args: [2],
        initial: first ?? '',
        reduce: (accumulator, value) => `${accumulator}${value ?? ''}`,
      });
    },
  });

  expectTypeOf(result).toEqualTypeOf<string>();

  const readonlyContainer: ReadonlyPluginContainer<ContractHookMap> = container.freeze();
  readonlyContainer.direct({
    hook: 'inspect',
    execute: (executor) => executor.first(['value']),
  });

  // @ts-expect-error readonly containers cannot mutate membership
  readonlyContainer.protect(plugin);
}

function rejectCallableMetadata(): void {
  type CallableMetadataPlugin = Plugin<
    ContractHookMap,
    'callable-metadata',
    {readonly configure: () => void}
  >;

  const plugin: CallableMetadataPlugin = {
    name: 'callable-metadata',
    // @ts-expect-error function-valued properties are executable hooks, not metadata
    configure: () => undefined,
  };
  type OptionalHandlerMetadataPlugin = Plugin<
    ContractHookMap,
    'optional-handler-metadata',
    {readonly options: {readonly handler?: () => void}}
  >;
  const optionalHandler: OptionalHandlerMetadataPlugin = {
    name: 'optional-handler-metadata',
    // @ts-expect-error optional callable handlers are also reserved for hook declarations
    options: {handler: () => undefined},
  };

  void plugin;
  void optionalHandler;
}

describe('plugin contracts', () => {
  it('allow consumer metadata without treating it as a lifecycle hook', () => {
    const plugin: ContractPlugin = {
      name: 'contract-plugin',
      wire: {protocol: 'wire-1'},
      inspect: () => undefined,
    };

    expectTypeOf(plugin.wire).toEqualTypeOf<
      | {
          readonly protocol: string;
        }
      | undefined
    >();
  });

  it('enumerates every public execution strategy', () => {
    expectTypeOf<ExecutionStrategy>().toEqualTypeOf<
      'parallel' | 'sequential' | 'first' | 'reduce' | 'pipe' | 'observe' | 'direct' | 'renderable'
    >();
  });

  it('expose typed protected, direct, observation, and pipe surfaces', () => {
    expectTypeOf(exerciseContainerContract).toBeFunction();
    expectTypeOf(rejectCallableMetadata).toBeFunction();
  });
});
