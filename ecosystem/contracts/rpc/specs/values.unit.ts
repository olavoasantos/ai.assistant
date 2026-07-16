import {describe, expectTypeOf, it} from 'vitest';
import type {
  RpcCallback,
  RpcCopy,
  RpcModel,
  RpcModelMetadata,
  RpcReference,
  RpcReferenceReleaser,
  RpcRemote,
  RpcRemoteModel,
  RpcRemotePromise,
  RpcRemoteReference,
  RpcRemoteRoot,
  RpcStream,
  RpcUnsupportedValue,
} from '../values';

interface PluginValue<Value> {
  readonly pluginValue: Value;
}

interface PluginRemoteValue<Value> {
  readonly remotePluginValue: Value;
}

declare module '..' {
  interface RpcValueProjections<_Value> {
    readonly test: _Value extends PluginValue<infer Inner>
      ? PluginRemoteValue<RpcRemote<Inner>>
      : never;
  }
}

interface Project {
  id: string;
  metadata: {
    labels: string[];
  };
  rename(name: string): void;
}

interface Tool {
  run(project: Project): Promise<{ok: boolean}>;
}

interface Decision {
  accepted: boolean;
}

interface Item {
  value: string;
}

interface RecursiveRecord {
  children: RecursiveRecord[];
  value: string;
}

type CopiedProjection = RpcRemote<{
  name: string;
  nested: {count: number};
  values: string[];
  tuple: [number, {enabled: boolean}];
  optional?: {label: string};
}>;

type AnyGuard<Value> = 0 extends 1 & Value ? true : false;
type UnsupportedGuard<Value> =
  Value extends RpcUnsupportedValue<infer _Value, infer _Reason> ? true : false;

function mutateCopiedValue(copied: CopiedProjection): void {
  // @ts-expect-error copied records are read-only after crossing
  copied.name = 'changed';
  // @ts-expect-error nested copied records are read-only
  copied.nested.count = 2;
  // @ts-expect-error copied arrays are read-only
  copied.values.push('changed');
}

describe('RPC remote value projection', () => {
  it('preserves supported primitives and distributes unions', () => {
    expectTypeOf<RpcRemote<string>>().toEqualTypeOf<string>();
    expectTypeOf<RpcRemote<number>>().toEqualTypeOf<number>();
    expectTypeOf<RpcRemote<boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<RpcRemote<null>>().toEqualTypeOf<null>();
    expectTypeOf<RpcRemote<undefined>>().toEqualTypeOf<undefined>();
    expectTypeOf<RpcRemote<string | null>>().toEqualTypeOf<string | null>();
  });

  it('projects copied records, arrays, tuples, and optional members as deeply read-only', () => {
    expectTypeOf<CopiedProjection>().toEqualTypeOf<{
      readonly name: string;
      readonly nested: {readonly count: number};
      readonly values: readonly string[];
      readonly tuple: readonly [number, {readonly enabled: boolean}];
      readonly optional?: {readonly label: string};
    }>();
    expectTypeOf(mutateCopiedValue).toBeFunction();
  });

  it('projects synchronous and asynchronous methods to exactly one promise layer', () => {
    interface Api {
      sync(): {ok: boolean};
      async(): Promise<{ok: boolean}>;
      empty(): void;
    }

    type Root = RpcRemoteRoot<Api>;

    expectTypeOf<ReturnType<Root['sync']>>().toEqualTypeOf<Promise<{readonly ok: boolean}>>();
    expectTypeOf<ReturnType<Root['async']>>().toEqualTypeOf<Promise<{readonly ok: boolean}>>();
    expectTypeOf<ReturnType<Root['empty']>>().toEqualTypeOf<Promise<void>>();
  });

  it('preserves optional methods, nested namespaces, and promise-valued properties', () => {
    interface Api {
      optional?(value: string): number;
      namespace: {
        label: string;
        load(): Project;
      };
      pending: Promise<Item>;
    }

    type Root = RpcRemoteRoot<Api>;

    expectTypeOf<Root['optional']>().toEqualTypeOf<
      ((value: string) => Promise<number>) | undefined
    >();
    expectTypeOf<ReturnType<Root['namespace']['load']>>().toEqualTypeOf<
      Promise<RpcRemote<Project>>
    >();
    expectTypeOf<Root['pending']>().toExtend<RpcRemotePromise<{readonly value: string}>>();
  });

  it('supports recursive copied records without losing nested readonly projection', () => {
    type RemoteRecord = RpcRemote<RecursiveRecord>;

    expectTypeOf<RemoteRecord['value']>().toEqualTypeOf<string>();
    expectTypeOf<RemoteRecord['children']>().toExtend<readonly RemoteRecord[]>();
  });

  it('keeps stream operations async iterable without a promise wrapper', () => {
    interface Api {
      inferred(): AsyncIterable<Item>;
      explicit(): RpcStream<Item>;
    }

    type Root = RpcRemoteRoot<Api>;

    expectTypeOf<ReturnType<Root['inferred']>>().toEqualTypeOf<
      AsyncIterable<{readonly value: string}>
    >();
    expectTypeOf<ReturnType<Root['explicit']>>().toEqualTypeOf<
      AsyncIterable<{readonly value: string}>
    >();
  });

  it('projects behavior-bearing objects and callable members as identity-bearing references', () => {
    interface Callable {
      (value: number): string;
      readonly label: string;
      inspect(): Item;
    }

    type RemoteProject = RpcRemote<Project>;
    type RemoteFunction = RpcRemote<Callable>;

    expectTypeOf<RemoteProject>().toExtend<RpcRemoteReference<Project>>();
    expectTypeOf<RemoteProject['id']>().toEqualTypeOf<string>();
    expectTypeOf<ReturnType<RemoteProject['rename']>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<RemoteFunction>().toExtend<RpcRemoteReference<Callable>>();
    expectTypeOf<ReturnType<RemoteFunction>>().toEqualTypeOf<Promise<string>>();
    expectTypeOf<RemoteFunction['label']>().toEqualTypeOf<string>();
    expectTypeOf<ReturnType<RemoteFunction['inspect']>>().toEqualTypeOf<
      Promise<{readonly value: string}>
    >();
  });

  it('supports copied envelopes containing nested references', () => {
    type Envelope = RpcCopy<{
      callback: (value: string) => number;
      projects: Project[];
    }>;
    type RemoteEnvelope = RpcRemote<Envelope>;

    expectTypeOf<RemoteEnvelope>().not.toExtend<RpcRemoteReference>();
    expectTypeOf<RemoteEnvelope['callback']>().toExtend<
      RpcRemoteReference<(value: string) => number>
    >();
    expectTypeOf<ReturnType<RemoteEnvelope['callback']>>().toEqualTypeOf<Promise<number>>();
    expectTypeOf<RemoteEnvelope['projects'][number]>().toExtend<RpcRemoteReference<Project>>();
  });

  it('forces identity for data-only references and exposes named-model metadata', () => {
    type Data = {id: string};
    type RemoteReference = RpcRemote<RpcReference<Data>>;
    type RemoteModel = RpcRemote<RpcModel<'Project', Project>>;

    expectTypeOf<RemoteReference>().toExtend<RpcRemoteReference<RpcReference<Data>>>();
    expectTypeOf<RemoteModel>().toExtend<RpcRemoteReference<RpcModel<'Project', Project>>>();
    expectTypeOf<RemoteModel>().toExtend<RpcRemoteModel<'Project'>>();
    expectTypeOf<RpcModelMetadata<'Project'>['name']>().toEqualTypeOf<'Project'>();
  });

  it('inverts reference ownership in method parameters and unions', () => {
    interface Api {
      inspect(project: Project): void;
      install(tool: RpcRemote<Tool>): void;
      acceptEither(tool: Tool | RpcRemote<Tool>): void;
    }

    type Root = RpcRemoteRoot<Api>;

    expectTypeOf<Parameters<Root['inspect']>[0]>().toEqualTypeOf<RpcRemote<Project>>();
    expectTypeOf<Parameters<Root['install']>[0]>().toEqualTypeOf<Tool>();
    expectTypeOf<Parameters<Root['acceptEither']>[0]>().toEqualTypeOf<RpcRemote<Tool> | Tool>();
  });

  it('projects callback arguments and results in opposite ownership directions', () => {
    type Callback = RpcCallback<(project: Project) => Decision>;

    interface Api {
      process(callback: Callback): Promise<{complete: boolean}>;
    }

    type Root = RpcRemoteRoot<Api>;
    type LocalCallback = Parameters<Root['process']>[0];

    expectTypeOf<Parameters<Callback>[0]>().toEqualTypeOf<Project>();
    expectTypeOf<ReturnType<Callback>>().toEqualTypeOf<Promise<{readonly accepted: boolean}>>();
    expectTypeOf<Parameters<LocalCallback>[0]>().toEqualTypeOf<RpcRemote<Project>>();
    expectTypeOf<ReturnType<LocalCallback>>().toEqualTypeOf<Promise<Decision>>();
  });

  it('retains one-shot promise shape and restores owner promises on round trip', () => {
    type OwnerPromise = Promise<{value: string}>;
    type RemotePromise = RpcRemote<OwnerPromise>;

    expectTypeOf<RemotePromise>().toExtend<Promise<{readonly value: string}>>();
    expectTypeOf<RemotePromise>().toExtend<RpcRemotePromise<{readonly value: string}>>();
    expectTypeOf<RpcRemote<RemotePromise>>().toEqualTypeOf<OwnerPromise>();
  });

  it('projects plugin-defined results and arguments through public declaration merging', () => {
    interface Api {
      accept(value: PluginValue<{name: string}>): boolean;
    }

    expectTypeOf<RpcRemote<PluginValue<{name: string}>>>().toEqualTypeOf<
      PluginRemoteValue<{readonly name: string}>
    >();
    expectTypeOf<Parameters<RpcRemoteRoot<Api>['accept']>[0]>().toEqualTypeOf<
      PluginRemoteValue<{readonly name: string}>
    >();
  });

  it('keeps the root outside ordinary reference release', () => {
    interface Api {
      ping(): string;
    }

    type Root = RpcRemoteRoot<Api>;
    type RootIsReference = Root extends RpcRemoteReference ? true : false;
    type RootHasReleaseMember = 'release' extends keyof Root ? true : false;

    expectTypeOf<RootIsReference>().toEqualTypeOf<false>();
    expectTypeOf<RootHasReleaseMember>().toEqualTypeOf<false>();
    expectTypeOf<RpcReferenceReleaser>().toBeCallableWith(
      undefined as unknown as RpcRemote<Project>,
    );
    // @ts-expect-error copied roots are not releasable references
    expectTypeOf<RpcReferenceReleaser>().toBeCallableWith(undefined as unknown as Root);
  });

  it('rejects symbol-keyed values and overloaded call signatures', () => {
    interface SymbolValue {
      readonly [SYMBOL_KEY]: string;
    }

    interface OverloadedFunction {
      (value: number): number;
      (value: string): string;
    }

    expectTypeOf<UnsupportedGuard<RpcRemote<SymbolValue>>>().toEqualTypeOf<true>();
    expectTypeOf<UnsupportedGuard<RpcRemoteRoot<SymbolValue>>>().toEqualTypeOf<true>();
    expectTypeOf<UnsupportedGuard<RpcRemote<OverloadedFunction>>>().toEqualTypeOf<true>();
  });

  it('rejects non-native thenables instead of treating them as object references', () => {
    interface Thenable extends PromiseLike<string> {
      readonly pending: true;
    }

    expectTypeOf<UnsupportedGuard<RpcRemote<Thenable>>>().toEqualTypeOf<true>();
  });

  it('produces explicit unsupported projections without leaking any', () => {
    expectTypeOf<UnsupportedGuard<RpcRemote<Date>>>().toEqualTypeOf<true>();
    expectTypeOf<UnsupportedGuard<RpcRemote<Map<string, number>>>>().toEqualTypeOf<true>();
    expectTypeOf<UnsupportedGuard<RpcRemote<bigint>>>().toEqualTypeOf<true>();
    expectTypeOf<UnsupportedGuard<RpcRemote<symbol>>>().toEqualTypeOf<true>();
    expectTypeOf<UnsupportedGuard<RpcRemote<typeof ProjectConstructor>>>().toEqualTypeOf<true>();
    expectTypeOf<AnyGuard<RpcRemote<any>>>().toEqualTypeOf<false>();
    expectTypeOf<UnsupportedGuard<RpcRemote<any>>>().toEqualTypeOf<true>();
    expectTypeOf<UnsupportedGuard<RpcRemote<unknown>>>().toEqualTypeOf<true>();
  });

  it('makes generic call signatures unusable rather than leaking unknown values', () => {
    type Generic = <Value>(value: Value) => Value;
    type RemoteGeneric = RpcRemote<Generic>;

    expectTypeOf<UnsupportedGuard<Parameters<RemoteGeneric>[0]>>().toEqualTypeOf<true>();
    expectTypeOf<UnsupportedGuard<Awaited<ReturnType<RemoteGeneric>>>>().toEqualTypeOf<true>();
  });
});

declare const ProjectConstructor: new (id: string) => {readonly id: string};
declare const SYMBOL_KEY: unique symbol;
