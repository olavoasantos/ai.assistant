/**
 * Service container types.
 *
 * Defines the dependency injection container that manages shared instances,
 * factories, and scoped overrides. The container supports hierarchical
 * fork semantics with live-link inheritance, four resolution strategies,
 * and deterministic disposal of cached values.
 */
import type {EventEmitter} from '../events';
import type {Services} from '..';

export type {Services} from '..';

/**
 * Describes how a service binding resolves its value.
 *
 * - `'value'` — a pre-constructed instance, returned as-is on every resolution.
 *   Inherited by reference across forks.
 * - `'singleton'` — the factory runs once at the registering scope on first
 *   resolution and the result is cached. Descendant scopes inherit the
 *   cached instance without re-invoking the factory.
 * - `'scoped'` — the factory is inherited by child scopes, but each scope
 *   lazily creates and caches its own instance on first resolution. Sibling
 *   scopes each get independent instances.
 * - `'transient'` — the factory runs on every resolution. Values are never
 *   cached. Each call to `ensure()` or `get()` produces a fresh instance.
 */
export type ServiceResolution = 'value' | 'singleton' | 'scoped' | 'transient';

/**
 * A factory function that creates a service value.
 *
 * Receives a read-only view of the container so it can resolve dependencies
 * without mutating the container during resolution. The container passed is
 * the one performing the resolution (the scope that triggered the factory),
 * not necessarily the scope where the binding was registered.
 *
 * @template Value - The type of value the factory produces.
 */
export interface ServiceFactory<Value> {
  /**
   * Creates the service value.
   *
   * @param container - A read-only view of the resolving container.
   * @returns The service value.
   */
  (container: ReadonlyServiceContainer<any>): Value;
}

/**
 * A disposal function invoked when a cached service value is being cleaned up.
 *
 * Called during {@link ServiceContainer.dispose} for each resolved singleton
 * and scoped binding that has a disposer registered. Transient bindings are
 * never disposed by the container since it does not retain references to them.
 *
 * @template Value - The type of value being disposed.
 */
export interface ServiceDisposer<Value> {
  /**
   * Disposes the service value.
   *
   * @param value - The cached service value to dispose.
   * @returns Optionally a promise if disposal is asynchronous.
   */
  (value: Value): void | Promise<void>;
}

/**
 * Descriptor for registering a service binding via {@link ServiceContainer.set}.
 *
 * The four convenience methods ({@link ServiceContainer.value},
 * {@link ServiceContainer.singleton}, {@link ServiceContainer.scoped},
 * {@link ServiceContainer.transient}) are sugar over `set()` with this
 * descriptor. Use `set()` directly when you need full control over
 * binding options or when working with dynamic namespace strings.
 *
 * @template Value - The type of value this binding resolves to.
 */
export interface ServiceBinding<Value = unknown> {
  /** The factory function that creates the service value. */
  factory: ServiceFactory<Value>;

  /** How the binding resolves and caches its value. */
  resolution: ServiceResolution;

  /**
   * Optional disposal function called when the container is disposed.
   *
   * Only meaningful for `'singleton'` and `'scoped'` resolutions, since
   * those are the only modes where the container retains a cached reference.
   */
  dispose?: ServiceDisposer<Value>;
}

/**
 * Read-only view of a service container.
 *
 * Exposes only resolution and inspection methods. Used as the type returned
 * by {@link ServiceContainer.freeze} and as the container reference passed
 * to {@link ServiceFactory} functions during resolution.
 *
 * Resolution walks local bindings first, then traverses the parent chain
 * established by {@link ServiceContainer.fork}. The parent link is live —
 * bindings registered on a parent after a fork are visible to the child.
 *
 * @template ServiceMap - The service map describing available namespaces and their types.
 */
export interface ReadonlyServiceContainer<ServiceMap extends Record<string, any> = Services> {
  /**
   * Resolves a service by namespace.
   *
   * Walks the local bindings first, then the parent chain. Throws if the
   * namespace is not registered anywhere in the chain.
   *
   * @template Namespace - The service namespace to resolve.
   * @param namespace - The namespace key.
   * @returns The resolved service value.
   * @throws When the namespace is not registered anywhere in the container chain.
   * @throws When a circular dependency is detected during resolution.
   */
  ensure<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
  ): ServiceMap[Namespace];

  /**
   * Resolves a service by namespace, returning `undefined` if not registered.
   *
   * Same resolution logic as {@link ensure} but returns `undefined` instead
   * of throwing when the namespace is not found.
   *
   * @template Namespace - The service namespace to resolve.
   * @param namespace - The namespace key.
   * @returns The resolved service value, or `undefined` if not registered.
   * @throws When a circular dependency is detected during resolution.
   */
  get<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
  ): ServiceMap[Namespace] | undefined;

  /**
   * Resolves a service by namespace, returning a fallback if not registered.
   *
   * Same resolution logic as {@link get} but returns the provided fallback
   * value instead of `undefined` when the namespace is not found.
   *
   * @template Namespace - The service namespace to resolve.
   * @param namespace - The namespace key.
   * @param fallback - The value to return if the namespace is not registered.
   * @returns The resolved service value, or the fallback.
   * @throws When a circular dependency is detected during resolution.
   */
  getOr<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    fallback: ServiceMap[Namespace],
  ): ServiceMap[Namespace];

  /**
   * Checks whether a namespace is registered anywhere in the container chain.
   *
   * The check traverses local bindings and the full parent chain via
   * live-link. A binding registered on a parent after this container was
   * forked is visible to this check.
   *
   * @template Namespace - The service namespace to check.
   * @param namespace - The namespace key.
   * @returns `true` if the namespace is registered.
   */
  has<Namespace extends Extract<keyof ServiceMap, string>>(namespace: Namespace): boolean;

  /**
   * Checks whether a namespace is NOT registered anywhere in the container chain.
   *
   * Inverse of {@link has}. Traverses local bindings and the full parent
   * chain via live-link.
   *
   * @template Namespace - The service namespace to check.
   * @param namespace - The namespace key.
   * @returns `true` if the namespace is not registered.
   */
  missing<Namespace extends Extract<keyof ServiceMap, string>>(namespace: Namespace): boolean;
}

/**
 * A typed dependency injection container with fork semantics.
 *
 * The service container manages shared instances, factories, and scoped
 * overrides. It extends {@link EventEmitter} to wire into the framework's
 * event tree and extends {@link ReadonlyServiceContainer} with write
 * operations for binding registration.
 *
 * Four binding modes control how values are created and cached:
 *
 * - **value** — a pre-constructed instance, inherited by reference across forks.
 * - **singleton** — factory runs once at the registering scope, cached instance
 *   is inherited by all descendant scopes.
 * - **scoped** — factory is inherited but each scope lazily creates and caches
 *   its own instance against its own container.
 * - **transient** — factory is inherited, called on every resolution, never cached.
 *
 * The {@link fork} method creates a child container that inherits parent
 * bindings via live-link (no snapshots). Children see parent bindings
 * registered after the fork. The child is wired as an {@link EventEmitter}
 * child, enabling event bubbling through the container hierarchy.
 *
 * @template ServiceMap - The service map describing available namespaces and their types.
 */
export interface ServiceContainer<ServiceMap extends Record<string, any> = Services>
  extends ReadonlyServiceContainer<ServiceMap>, EventEmitter<Record<string, any>> {
  /**
   * Registers a service binding from a descriptor.
   *
   * This is the primitive registration method. The convenience methods
   * ({@link value}, {@link singleton}, {@link scoped}, {@link transient})
   * are sugar over this method.
   *
   * Silently overwrites any existing binding at the same namespace.
   *
   * @template Value - The type of value this binding resolves to.
   * @param namespace - The namespace key.
   * @param binding - The service binding descriptor.
   * @returns `this` for fluent chaining.
   * @throws When the container is frozen.
   * @throws When the container has been disposed.
   */
  set<Value>(namespace: string, binding: ServiceBinding<Value>): this;

  /**
   * Registers a pre-constructed value.
   *
   * The value is returned as-is on every resolution. In forked containers,
   * the same object reference is inherited — all scopes share the instance.
   *
   * @template Namespace - The service namespace.
   * @param namespace - The namespace key.
   * @param instance - The pre-constructed value.
   * @returns `this` for fluent chaining.
   * @throws When the container is frozen.
   * @throws When the container has been disposed.
   */
  value<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    instance: ServiceMap[Namespace],
  ): this;

  /**
   * Registers a singleton factory.
   *
   * The factory runs once on first resolution at the registering scope.
   * The cached instance is inherited by all descendant scopes — they
   * receive the same object reference without re-invoking the factory.
   *
   * @template Namespace - The service namespace.
   * @param namespace - The namespace key.
   * @param factory - The factory function that creates the value.
   * @param dispose - Optional disposal function called during container dispose.
   * @returns `this` for fluent chaining.
   * @throws When the container is frozen.
   * @throws When the container has been disposed.
   */
  singleton<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    factory: ServiceFactory<ServiceMap[Namespace]>,
    dispose?: ServiceDisposer<ServiceMap[Namespace]>,
  ): this;

  /**
   * Registers a scoped factory.
   *
   * The factory is inherited by child scopes, but each scope lazily creates
   * and caches its own instance on first resolution. Sibling scopes each
   * receive independent instances. The factory receives the resolving
   * scope's container, not the registering scope's container.
   *
   * @template Namespace - The service namespace.
   * @param namespace - The namespace key.
   * @param factory - The factory function that creates the value.
   * @param dispose - Optional disposal function called during container dispose.
   * @returns `this` for fluent chaining.
   * @throws When the container is frozen.
   * @throws When the container has been disposed.
   */
  scoped<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    factory: ServiceFactory<ServiceMap[Namespace]>,
    dispose?: ServiceDisposer<ServiceMap[Namespace]>,
  ): this;

  /**
   * Registers a transient factory.
   *
   * The factory runs on every resolution. Values are never cached — each
   * call to {@link ensure} or {@link get} produces a fresh instance. Because
   * the container does not retain transient values, no disposer is accepted.
   *
   * @template Namespace - The service namespace.
   * @param namespace - The namespace key.
   * @param factory - The factory function that creates the value.
   * @returns `this` for fluent chaining.
   * @throws When the container is frozen.
   * @throws When the container has been disposed.
   */
  transient<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    factory: ServiceFactory<ServiceMap[Namespace]>,
  ): this;

  /**
   * Creates a child container that inherits this container's bindings.
   *
   * The child uses live-link inheritance: it sees the parent's current
   * state, including bindings registered after the fork. Local bindings
   * in the child override inherited ones without affecting the parent.
   *
   * Optionally accepts initial values to pre-populate the child container
   * as value bindings. The child is wired as an {@link EventEmitter} child,
   * so events emitted on the child bubble to this container.
   *
   * Forking is permitted even on frozen containers — the child starts
   * unfrozen with its own independent mutation state.
   *
   * @template ChildServiceMap - The service map for the child, defaults to parent's map.
   * @param values - Optional record of namespace/value pairs to pre-populate.
   * @returns A new child service container.
   */
  fork<ChildServiceMap extends ServiceMap = ServiceMap>(
    values?: Partial<ChildServiceMap>,
  ): ServiceContainer<ChildServiceMap>;

  /**
   * Freezes the container, preventing any further write operations.
   *
   * After freezing, calls to {@link set}, {@link value}, {@link singleton},
   * {@link scoped}, and {@link transient} will throw. Read operations
   * ({@link ensure}, {@link get}, {@link getOr}, {@link has}, {@link missing})
   * remain available. {@link fork} is also still permitted.
   *
   * Freezing is one-way — there is no unfreeze.
   *
   * @returns A read-only view of this container.
   */
  freeze(): ReadonlyServiceContainer<ServiceMap>;

  /**
   * Disposes the container and all its cached service values.
   *
   * Calls the registered disposer on each resolved singleton and scoped
   * binding that has a disposer, clears all cached values, and marks the
   * container as terminally disposed. Any subsequent interaction with the
   * container (reads or writes) will throw.
   *
   * Disposal order is the reverse of resolution order for cached bindings.
   *
   * @returns A promise that resolves when all disposers have completed.
   */
  dispose(): Promise<void>;
}
