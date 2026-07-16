/** Type-only slot for opaque contract facets; it implies no runtime symbol representation. */
declare const RPC_VALUE_CONTRACT: unique symbol;

type RpcFunction = (...arguments_: any[]) => unknown;
type RpcPrimitive = string | number | boolean | null | undefined;
type RpcConstructor = abstract new (...arguments_: any[]) => unknown;
type RpcUnsupportedBuiltIn =
  | bigint
  | symbol
  | Date
  | RegExp
  | Error
  | Map<unknown, unknown>
  | ReadonlyMap<unknown, unknown>
  | Set<unknown>
  | ReadonlySet<unknown>
  | WeakMap<object, unknown>
  | WeakSet<object>
  | WeakRef<object>
  | ArrayBuffer
  | ArrayBufferView
  | DataView
  | URL;

interface RpcValueContract<Facets extends object> {
  readonly [RPC_VALUE_CONTRACT]: Facets;
}

interface RpcCallbackIntent<Signature extends RpcFunction> extends RpcValueContract<{
  readonly callback: Signature;
}> {}

interface RpcCopyIntent<Value extends object> extends RpcValueContract<{readonly copy: Value}> {}

interface RpcModelIntent<Name extends string, Value extends object> extends RpcValueContract<{
  readonly model: readonly [Name, Value];
}> {}

interface RpcReferenceIntent<Value extends object> extends RpcValueContract<{
  readonly reference: Value;
}> {}

interface RpcRemotePromiseIdentity<OwnerPromise extends Promise<unknown>> extends RpcValueContract<{
  readonly remotePromise: OwnerPromise;
}> {}

interface RpcStreamIntent<Item> extends RpcValueContract<{readonly stream: Item}> {}

/**
 * A value explicitly designated to cross as a copied container.
 *
 * Use copy intent only when structural classification would otherwise treat
 * the container as identity-bearing, such as a record containing callbacks.
 * The eventual runtime marker is opaque and carries no wire authority.
 *
 * @template Value - The owner-side container shape.
 */
export type RpcCopy<Value extends object> = Value & RpcCopyIntent<Value>;

/**
 * A value explicitly designated to retain identity across an RPC session.
 *
 * This intent disambiguates data-only objects that would otherwise cross by
 * copy. It does not expose a reference identifier or grant authority outside
 * the session that receives the value.
 *
 * @template Value - The owner-side object or function shape.
 */
export type RpcReference<Value extends object> = Value & RpcReferenceIntent<Value>;

/**
 * An identity-bearing owner-side model with stable inspection information.
 *
 * The name supports remote inspection only. It does not expose or transport a
 * constructor and does not permit remote construction.
 *
 * @template Name - The stable model name.
 * @template Value - The owner-side model shape.
 */
export type RpcModel<Name extends string, Value extends object> = Value &
  RpcModelIntent<Name, Value> &
  RpcReferenceIntent<Value>;

/**
 * An async iterable explicitly designated as an RPC stream.
 *
 * Ordinary async-iterable operation results use the same remote iteration
 * shape. Explicit intent allows stream-specific contracts to refine policy
 * without changing the consumer's `AsyncIterable` surface.
 *
 * @template Item - The owner-side stream item type.
 */
export type RpcStream<Item> = AsyncIterable<Item> & RpcStreamIntent<Item>;

/**
 * Opaque identity carried by an object or function hydrated from its owner.
 *
 * The brand records ownership only in the type system. It exposes no session,
 * registry, or wire identifier.
 *
 * @template OwnerValue - The value shape at the node that owns the reference.
 */
export interface RpcRemoteReference<OwnerValue extends object = object> extends RpcValueContract<{
  readonly remoteReference: OwnerValue;
}> {}

/**
 * A promise-shaped, one-shot remote promise.
 *
 * It has ordinary `Promise` consumption semantics but uses settlement rather
 * than object/function release for lifecycle cleanup.
 *
 * @template Value - The remotely projected settlement value.
 */
export type RpcRemotePromise<Value> = Promise<Value> & RpcRemotePromiseIdentity<Promise<Value>>;

/**
 * Stable inspection information for a named remote model.
 *
 * @template Name - The stable owner-defined model name.
 */
export interface RpcModelMetadata<Name extends string = string> {
  /** The stable model name supplied by the owner. */
  readonly name: Name;
}

/**
 * Opaque named-model identity carried by a hydrated remote model.
 *
 * @template Name - The stable owner-defined model name.
 */
export interface RpcRemoteModel<Name extends string = string> extends RpcValueContract<{
  readonly remoteModel: RpcModelMetadata<Name>;
}> {}

/** Contract for inspecting named-model metadata without exposing constructors. */
export interface RpcModelInspector {
  /**
   * Reads metadata from a known named remote model.
   *
   * @template Name - The stable model name.
   * @param value - The named remote model to inspect.
   * @returns Its stable metadata.
   */
  <Name extends string>(value: RpcRemoteModel<Name>): RpcModelMetadata<Name>;

  /**
   * Attempts to read named-model metadata from an arbitrary value.
   *
   * @param value - The value to inspect.
   * @returns Stable metadata, or `undefined` when the value is not a named model.
   */
  (value: unknown): RpcModelMetadata | undefined;
}

/** Contract for deterministic early release of a hydrated remote reference. */
export interface RpcReferenceReleaser {
  /**
   * Invalidates a local facade and schedules at most one effective release.
   *
   * This operation is synchronous, idempotent, and does not acknowledge
   * owner-side domain cleanup.
   *
   * @param reference - The object or function reference to release early.
   */
  (reference: RpcRemoteReference): void;
}

/**
 * An unusable projection produced for a value unsupported by RPC core.
 *
 * A negotiated value plugin may replace this outcome by augmenting
 * {@link RpcValueProjections}. Runtime-only shape failures must reject with a
 * clear exposure or operation error.
 *
 * @template Value - The unsupported owner-side value type.
 * @template Reason - A diagnostic description of why projection failed.
 */
export interface RpcUnsupportedValue<
  Value = unknown,
  Reason extends string = 'Unsupported RPC value',
> extends RpcValueContract<{readonly unsupported: readonly [Value, Reason]}> {}

/**
 * Extensible remote projection registry for negotiated value plugins.
 *
 * A value-plugin package augments this generic interface with a conditional
 * property whose value is the type observed after one ownership-boundary
 * crossing. Unmatched entries must resolve to `never`.
 *
 * @template Value - The value currently crossing the RPC boundary.
 */
export interface RpcValueProjections<_Value> {
  //
}

/**
 * A remotely invocable callback issued by the other node.
 *
 * The source signature describes each value before its directional crossing:
 * arguments leave the owner and the result leaves the implementation. The
 * owner-side callable and peer-side implementation both expose asynchronous
 * invocation while observing each other's values through remote projection.
 *
 * @template Signature - The callback implementation's source signature.
 */
export type RpcCallback<Signature extends RpcFunction> = RpcCallbackOwnerView<Signature> &
  RpcCallbackIntent<Signature> &
  RpcRemoteReference<Signature>;

/**
 * Projects one value across an RPC ownership boundary.
 *
 * Local references become remote facades; already-remote references sent back
 * become their original owner-side values. Copied data becomes deeply
 * read-only, calls become promise-returning, and streams remain async iterable.
 *
 * @template Value - The value shape before crossing the boundary.
 */
export type RpcRemote<Value> = RpcCross<Value>;

/**
 * Projects a server-owned root API into its live client-facing facade.
 *
 * Root members use the same value and operation projection as ordinary remote
 * objects, but the root itself has no ordinary reference brand or early-release
 * lifecycle.
 *
 * @template Api - The unprojected API owned by the remote node.
 */
export type RpcRemoteRoot<Api extends object> =
  RpcHasSymbolKeys<Api> extends true
    ? RpcUnsupportedValue<Api, 'Symbol-keyed root APIs are not supported'>
    : RpcRemoteObjectMembers<Api>;

type RpcCallbackImplementation<Signature extends RpcFunction> =
  RpcHasOverloads<Signature> extends true
    ? RpcUnsupportedValue<Signature, 'Overloaded callbacks are not supported'>
    : Signature extends (...arguments_: infer Arguments) => infer Result
      ? (
          ...arguments_: {[Index in keyof Arguments]: RpcCross<Arguments[Index]>}
        ) => Promise<Awaited<Result>>
      : RpcUnsupportedValue<Signature, 'Callback must have one call signature'>;

type RpcCallbackOwnerView<Signature extends RpcFunction> =
  RpcHasOverloads<Signature> extends true
    ? RpcUnsupportedValue<Signature, 'Overloaded callbacks are not supported'>
    : Signature extends (...arguments_: infer Arguments) => infer Result
      ? (...arguments_: Arguments) => Promise<RpcCross<Awaited<Result>>>
      : RpcUnsupportedValue<Signature, 'Callback must have one call signature'>;

type RpcCallSignatureUnion<Value extends RpcFunction> = Value extends {
  (...arguments_: infer FirstArguments): infer FirstResult;
  (...arguments_: infer SecondArguments): infer SecondResult;
}
  ?
      | ((...arguments_: FirstArguments) => FirstResult)
      | ((...arguments_: SecondArguments) => SecondResult)
  : never;

type RpcCallableKeys<Value extends object> = {
  [Key in keyof Value]-?: Extract<NonNullable<Value[Key]>, RpcFunction> extends never ? never : Key;
}[keyof Value];

type RpcCross<Value> =
  RpcIsAny<Value> extends true
    ? RpcUnsupportedValue<Value, 'any is not a safe RPC contract'>
    : [Value] extends [never]
      ? never
      : RpcIsUnknown<Value> extends true
        ? RpcUnsupportedValue<Value, 'unknown requires an explicit RPC value contract'>
        : Value extends unknown
          ? RpcCrossDistributed<Value>
          : never;

type RpcCrossDistributed<Value> =
  Value extends RpcCallbackIntent<infer Signature>
    ? RpcCallbackImplementation<Signature>
    : Value extends RpcRemotePromiseIdentity<infer OwnerPromise>
      ? OwnerPromise
      : Value extends RpcRemoteReference<infer OwnerValue>
        ? OwnerValue
        : RpcPluginProjection<Value> extends infer PluginValue
          ? [PluginValue] extends [never]
            ? RpcCrossCore<Value>
            : PluginValue
          : never;

type RpcCrossCore<Value> =
  Value extends RpcCopyIntent<infer CopiedValue>
    ? RpcRemoteCopy<CopiedValue>
    : Value extends RpcModelIntent<infer Name, infer ModelValue>
      ? RpcRemoteObjectReference<ModelValue, Value> & RpcRemoteModel<Name>
      : Value extends RpcReferenceIntent<infer ReferenceValue>
        ? RpcRemoteReferenceValue<ReferenceValue, Value>
        : Value extends RpcStreamIntent<infer Item>
          ? AsyncIterable<RpcCross<Item>>
          : Value extends RpcPrimitive
            ? Value
            : Value extends void
              ? void
              : Value extends RpcUnsupportedBuiltIn
                ? RpcUnsupportedValue<Value, 'Value requires a negotiated RPC value plugin'>
                : Value extends Promise<infer Settlement>
                  ? RpcRemotePromiseOf<Value, Settlement>
                  : Value extends PromiseLike<unknown>
                    ? RpcUnsupportedValue<Value, 'Thenables must use native Promise contracts'>
                    : Value extends AsyncIterable<infer Item>
                      ? AsyncIterable<RpcCross<Item>>
                      : Value extends RpcConstructor
                        ? RpcUnsupportedValue<Value, 'Remote construction is not supported'>
                        : Value extends RpcFunction
                          ? RpcRemoteFunction<Value>
                          : Value extends readonly unknown[]
                            ? RpcRemoteArray<Value>
                            : Value extends object
                              ? RpcRemoteObject<Value>
                              : RpcUnsupportedValue<Value>;

type RpcHasCallableMembers<Value extends object> = [RpcCallableKeys<Value>] extends [never]
  ? false
  : true;

type RpcHasOverloads<Value extends RpcFunction> = RpcIsUnion<RpcCallSignatureUnion<Value>>;

type RpcHasSymbolKeys<Value extends object> = [Extract<keyof Value, symbol>] extends [never]
  ? false
  : true;

type RpcIsAny<Value> = 0 extends 1 & Value ? true : false;

type RpcIsUnion<Value, Candidate = Value> = Value extends unknown
  ? [Candidate] extends [Value]
    ? false
    : true
  : never;

type RpcIsUnknown<Value> = unknown extends Value
  ? [Value] extends [unknown]
    ? true
    : false
  : false;

type RpcLocalInput<Value> =
  RpcIsAny<Value> extends true
    ? RpcUnsupportedValue<Value, 'any is not a safe RPC argument'>
    : [Value] extends [never]
      ? never
      : RpcIsUnknown<Value> extends true
        ? RpcUnsupportedValue<Value, 'unknown requires an explicit RPC argument contract'>
        : Value extends unknown
          ? RpcLocalInputDistributed<Value>
          : never;

type RpcLocalInputDistributed<Value> =
  Value extends RpcCallbackIntent<infer Signature>
    ? RpcCallbackImplementation<Signature>
    : Value extends RpcRemotePromiseIdentity<infer OwnerPromise>
      ? OwnerPromise
      : Value extends RpcRemoteReference<infer OwnerValue>
        ? OwnerValue
        : RpcPluginProjection<Value> extends infer PluginValue
          ? [PluginValue] extends [never]
            ? RpcLocalInputCore<Value>
            : PluginValue
          : never;

type RpcLocalInputCore<Value> = Value extends RpcPrimitive
  ? Value
  : Value extends void
    ? void
    : Value extends RpcCopyIntent<infer CopiedValue>
      ? RpcCopy<RpcLocalInputObject<CopiedValue>>
      : Value extends readonly unknown[]
        ? {[Index in keyof Value]: RpcLocalInput<Value[Index]>}
        : Value extends object
          ? RpcHasCallableMembers<Value> extends true
            ? RpcCross<Value>
            : RpcLocalInputObject<Value>
          : RpcCross<Value>;

type RpcLocalInputObject<Value extends object> = {
  [Key in keyof Value]: RpcLocalInput<Value[Key]>;
};

type RpcPluginProjection<Value> = RpcValueProjections<Value>[keyof RpcValueProjections<Value>];

type RpcRemoteArray<Value extends readonly unknown[]> = Readonly<{
  [Index in keyof Value]: RpcCross<Value[Index]>;
}>;

type RpcRemoteCopy<Value extends object> =
  RpcHasSymbolKeys<Value> extends true
    ? RpcUnsupportedValue<Value, 'Symbol-keyed copied values are not supported'>
    : {
        readonly [Key in keyof Value]: RpcCross<Value[Key]>;
      };

type RpcRemoteFunction<Value extends RpcFunction> = RpcRemoteMethod<Value> &
  RpcRemoteObjectMembers<Value> &
  RpcRemoteReference<Value>;

type RpcRemoteMethod<Value extends RpcFunction> =
  RpcHasOverloads<Value> extends true
    ? RpcUnsupportedValue<Value, 'Overloaded remote functions are not supported'>
    : Value extends (...arguments_: infer Arguments) => infer Result
      ? (
          ...arguments_: {[Index in keyof Arguments]: RpcLocalInput<Arguments[Index]>}
        ) => RpcRemoteOperationResult<Result>
      : RpcUnsupportedValue<Value, 'Function must have one call signature'>;

type RpcRemoteObject<Value extends object> =
  RpcHasSymbolKeys<Value> extends true
    ? RpcUnsupportedValue<Value, 'Symbol-keyed objects require an RPC value plugin'>
    : RpcHasCallableMembers<Value> extends true
      ? RpcRemoteObjectReference<Value, Value>
      : RpcRemoteCopy<Value>;

type RpcRemoteMember<Value> = [Extract<NonNullable<Value>, RpcFunction>] extends [never]
  ? RpcCross<Value>
  :
      | RpcRemoteMethod<Extract<NonNullable<Value>, RpcFunction>>
      | RpcCross<Exclude<Value, RpcFunction>>;

type RpcRemoteObjectMembers<Value extends object> = {
  readonly [Key in keyof Value]: RpcRemoteMember<Value[Key]>;
};

type RpcRemoteObjectReference<
  Value extends object,
  OwnerValue extends object,
> = RpcRemoteObjectMembers<Value> & RpcRemoteReference<OwnerValue>;

type RpcRemoteOperationResult<Result> =
  Result extends RpcStreamIntent<infer Item>
    ? AsyncIterable<RpcCross<Item>>
    : Result extends AsyncIterable<infer Item>
      ? AsyncIterable<RpcCross<Item>>
      : Promise<RpcCross<Awaited<Result>>>;

type RpcRemotePromiseOf<OwnerPromise extends Promise<unknown>, Settlement> = Promise<
  RpcCross<Settlement>
> &
  RpcRemotePromiseIdentity<OwnerPromise>;

type RpcRemoteReferenceValue<
  Value extends object,
  OwnerValue extends object,
> = Value extends RpcFunction
  ? RpcRemoteMethod<Value> & RpcRemoteObjectMembers<Value> & RpcRemoteReference<OwnerValue>
  : RpcRemoteObjectReference<Value, OwnerValue>;
