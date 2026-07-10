import type * as Contracts from '@ai.assistant/contracts/service-container';
import {ApplicationError} from '@ai.assistant/error';
import {EventEmitter} from '@ai.assistant/event-emitter';
import {signal} from '@preact/signals-core';
import {
  NOT_RESOLVED,
  SERVICE_CONTAINER_BINDINGS,
  SERVICE_CONTAINER_DISPOSED,
  SERVICE_CONTAINER_FROZEN,
  SERVICE_CONTAINER_IDENTIFIER,
  SERVICE_CONTAINER_PARENT,
  SERVICE_CONTAINER_RESOLUTION_ORDER,
  SERVICE_CONTAINER_RESOLVING,
} from '../constants';
import type {InternalBinding} from '../types';

/**
 * A typed dependency injection container with fork semantics.
 *
 * Manages shared instances, factories, and scoped overrides for the
 * framework. Extends {@link EventEmitter} to wire into the framework's
 * event tree.
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
 * Use `fork()` to create child containers that inherit parent bindings via
 * live-link. Use `freeze()` to lock the container against further writes.
 *
 * @template ServiceMap - The service map describing available namespaces and their types.
 */
export class ServiceContainer<ServiceMap extends Record<string, any> = Contracts.Services>
  extends EventEmitter
  implements Contracts.ServiceContainer<ServiceMap>
{
  /** Symbol brand for cross-boundary identity checks. */
  readonly [SERVICE_CONTAINER_IDENTIFIER] = true as const;

  /** @internal Local bindings map. */
  [SERVICE_CONTAINER_BINDINGS]: Map<string, InternalBinding> = new Map();

  /** @internal Parent container in the fork chain. */
  [SERVICE_CONTAINER_PARENT]: ServiceContainer<any> | null = null;

  /** @internal Whether the container is frozen against writes. */
  [SERVICE_CONTAINER_FROZEN] = false;

  /** @internal Whether the container has been disposed. */
  [SERVICE_CONTAINER_DISPOSED] = false;

  /** @internal Set of namespaces currently being resolved (cycle detection). */
  [SERVICE_CONTAINER_RESOLVING]: Set<string> | null = null;

  /** @internal Tracks resolution order for deterministic disposal. */
  [SERVICE_CONTAINER_RESOLUTION_ORDER]: string[] = [];

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
   * @throws When the container is frozen or disposed.
   */
  set<Value>(namespace: string, binding: Contracts.ServiceBinding<Value>): this {
    this.ensureWritable();

    const existing = this[SERVICE_CONTAINER_BINDINGS].get(namespace);
    let cached: InternalBinding<Value>['cached'];

    if (binding.resolution === 'transient') {
      if (existing?.cached != null) {
        existing.cached.value = NOT_RESOLVED;
      }
      cached = null;
    } else if (existing?.cached != null) {
      cached = existing.cached as InternalBinding<Value>['cached'];
      cached!.value =
        binding.resolution === 'value'
          ? binding.factory(this as Contracts.ReadonlyServiceContainer<ServiceMap>)
          : NOT_RESOLVED;
    } else {
      cached = signal<Value | typeof NOT_RESOLVED>(
        binding.resolution === 'value'
          ? binding.factory(this as Contracts.ReadonlyServiceContainer<ServiceMap>)
          : NOT_RESOLVED,
      );
    }

    const internal: InternalBinding<Value> = {
      namespace,
      factory: binding.factory,
      resolution: binding.resolution,
      cached,
      dispose: binding.dispose,
    };

    this[SERVICE_CONTAINER_BINDINGS].set(namespace, internal as InternalBinding);

    return this;
  }

  /**
   * Registers a pre-constructed value.
   *
   * The value is returned as-is on every resolution. In forked containers,
   * the same object reference is inherited.
   *
   * @template Namespace - The service namespace.
   * @param namespace - The namespace key.
   * @param instance - The pre-constructed value.
   * @returns `this` for fluent chaining.
   * @throws When the container is frozen or disposed.
   */
  value<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    instance: ServiceMap[Namespace],
  ): this {
    return this.set(namespace, {
      factory: () => instance,
      resolution: 'value',
    });
  }

  /**
   * Registers a singleton factory.
   *
   * The factory runs once on first resolution at the registering scope.
   * The cached instance is inherited by all descendant scopes.
   *
   * @template Namespace - The service namespace.
   * @param namespace - The namespace key.
   * @param factory - The factory function.
   * @param dispose - Optional disposal function.
   * @returns `this` for fluent chaining.
   * @throws When the container is frozen or disposed.
   */
  singleton<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    factory: Contracts.ServiceFactory<ServiceMap[Namespace]>,
    dispose?: Contracts.ServiceDisposer<ServiceMap[Namespace]>,
  ): this {
    return this.set(namespace, {factory, resolution: 'singleton', dispose});
  }

  /**
   * Registers a scoped factory.
   *
   * The factory is inherited by child scopes, but each scope lazily creates
   * and caches its own instance against its own container on first resolution.
   *
   * @template Namespace - The service namespace.
   * @param namespace - The namespace key.
   * @param factory - The factory function.
   * @param dispose - Optional disposal function.
   * @returns `this` for fluent chaining.
   * @throws When the container is frozen or disposed.
   */
  scoped<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    factory: Contracts.ServiceFactory<ServiceMap[Namespace]>,
    dispose?: Contracts.ServiceDisposer<ServiceMap[Namespace]>,
  ): this {
    return this.set(namespace, {factory, resolution: 'scoped', dispose});
  }

  /**
   * Registers a transient factory.
   *
   * The factory runs on every resolution. Values are never cached.
   *
   * @template Namespace - The service namespace.
   * @param namespace - The namespace key.
   * @param factory - The factory function.
   * @returns `this` for fluent chaining.
   * @throws When the container is frozen or disposed.
   */
  transient<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    factory: Contracts.ServiceFactory<ServiceMap[Namespace]>,
  ): this {
    return this.set(namespace, {factory, resolution: 'transient'});
  }

  /**
   * Resolves a service by namespace.
   *
   * Walks the local bindings first, then the parent chain. Throws if the
   * namespace is not registered anywhere in the chain.
   *
   * @template Namespace - The service namespace to resolve.
   * @param namespace - The namespace key.
   * @returns The resolved service value.
   * @throws When the namespace is not registered.
   * @throws When a circular dependency is detected during resolution.
   */
  ensure<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
  ): ServiceMap[Namespace] {
    this.ensureNotDisposed();

    if (this.missing(namespace)) {
      throw new ApplicationError({
        message: `Service "${namespace}" is not registered. Did you forget to register it?`,
        code: 500,
        metadata: {namespace},
      });
    }

    return this.resolve(namespace) as ServiceMap[Namespace];
  }

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
  ): ServiceMap[Namespace] | undefined {
    this.ensureNotDisposed();

    if (this.missing(namespace)) {
      return undefined;
    }

    return this.resolve(namespace);
  }

  /**
   * Resolves a service by namespace, returning a fallback if not registered.
   *
   * Same resolution logic as {@link get} but returns the fallback value
   * instead of `undefined` when the namespace is not found.
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
  ): ServiceMap[Namespace] {
    this.ensureNotDisposed();

    if (this.missing(namespace)) {
      return fallback;
    }

    return this.resolve(namespace) as ServiceMap[Namespace];
  }

  /**
   * Checks whether a namespace is registered, including inherited bindings
   * from parent containers in the fork chain.
   *
   * @template Namespace - The service namespace to check.
   * @param namespace - The namespace key.
   * @returns `true` if the namespace is registered.
   */
  has<Namespace extends Extract<keyof ServiceMap, string>>(namespace: Namespace): boolean {
    this.ensureNotDisposed();

    if (this[SERVICE_CONTAINER_BINDINGS].has(namespace)) {
      return true;
    }

    if (this[SERVICE_CONTAINER_PARENT] != null) {
      if (this[SERVICE_CONTAINER_PARENT][SERVICE_CONTAINER_DISPOSED]) {
        return false;
      }
      return this[SERVICE_CONTAINER_PARENT].has(namespace);
    }

    return false;
  }

  /**
   * Checks whether a namespace is NOT registered, including inherited bindings
   * from parent containers in the fork chain.
   *
   * @template Namespace - The service namespace to check.
   * @param namespace - The namespace key.
   * @returns `true` if the namespace is not registered.
   */
  missing<Namespace extends Extract<keyof ServiceMap, string>>(namespace: Namespace): boolean {
    return !this.has(namespace);
  }

  /**
   * Registers a listener for an event name or glob pattern.
   *
   * @throws When the container has been disposed.
   */
  override on(...args: Parameters<EventEmitter['on']>): ReturnType<EventEmitter['on']> {
    this.ensureNotDisposed();
    return super.on(...args);
  }

  /**
   * Registers a one-shot listener for an event name or glob pattern.
   *
   * @throws When the container has been disposed.
   */
  override once(...args: Parameters<EventEmitter['once']>): ReturnType<EventEmitter['once']> {
    this.ensureNotDisposed();
    return super.once(...args);
  }

  /**
   * Removes a previously registered listener.
   *
   * @throws When the container has been disposed.
   */
  override off(...args: Parameters<EventEmitter['off']>): ReturnType<EventEmitter['off']> {
    this.ensureNotDisposed();
    super.off(...args);
  }

  /**
   * Emits an event.
   *
   * @throws When the container has been disposed.
   */
  override emit(...args: Parameters<EventEmitter['emit']>): ReturnType<EventEmitter['emit']> {
    this.ensureNotDisposed();
    return super.emit(...args);
  }

  /**
   * Adds a child emitter whose events bubble to this container.
   *
   * @throws When the container has been disposed.
   */
  override addChild(
    ...args: Parameters<EventEmitter['addChild']>
  ): ReturnType<EventEmitter['addChild']> {
    this.ensureNotDisposed();
    return super.addChild(...args);
  }

  /**
   * Removes a previously attached child emitter.
   *
   * @throws When the container has been disposed.
   */
  override removeChild(
    ...args: Parameters<EventEmitter['removeChild']>
  ): ReturnType<EventEmitter['removeChild']> {
    this.ensureNotDisposed();
    super.removeChild(...args);
  }

  /**
   * Creates a child container that inherits this container's bindings.
   *
   * The child uses live-link inheritance: it sees the parent's current
   * state, including bindings registered after the fork. Local bindings
   * in the child override inherited ones without affecting the parent.
   *
   * @template ChildServiceMap - Optional extended service map for the child scope.
   * @param values - Optional map of namespace-value pairs to register as value bindings in the child.
   * @returns A new child service container.
   */
  fork<ChildServiceMap extends ServiceMap = ServiceMap>(
    values?: Partial<ChildServiceMap>,
  ): ServiceContainer<ChildServiceMap> {
    this.ensureNotDisposed();

    const child = new ServiceContainer<ChildServiceMap>();
    child[SERVICE_CONTAINER_PARENT] = this;
    this.addChild(child);

    if (values != null) {
      for (const [namespace, instance] of Object.entries(values)) {
        child.value(namespace as Extract<keyof ChildServiceMap, string>, instance as any);
      }
    }

    return child;
  }

  /**
   * Freezes the container, preventing any further write operations.
   *
   * After freezing, calls to {@link set}, {@link value}, {@link singleton},
   * {@link scoped}, and {@link transient} will throw. Read operations
   * ({@link ensure}, {@link get}, {@link has}, {@link missing}) remain available.
   *
   * Freezing is one-way — there is no unfreeze.
   *
   * @returns A read-only view of this container.
   */
  freeze(): Contracts.ReadonlyServiceContainer<ServiceMap> {
    this[SERVICE_CONTAINER_FROZEN] = true;
    return this;
  }

  /**
   * Disposes the container and all its cached service values.
   *
   * Calls the registered disposer on each resolved singleton and scoped
   * binding in reverse-resolution order, clears all cached values, and
   * marks the container as disposed. Any subsequent interaction with
   * the container will throw.
   *
   * @returns A promise that resolves when all disposers have completed.
   */
  async dispose(): Promise<void> {
    this.ensureNotDisposed();
    this[SERVICE_CONTAINER_DISPOSED] = true;

    const promises: Array<Promise<void>> = [];
    const order = this[SERVICE_CONTAINER_RESOLUTION_ORDER];
    const disposed = new Set<string>();

    for (let i = order.length - 1; i >= 0; i--) {
      const namespace = order[i];
      if (disposed.has(namespace)) {
        continue;
      }
      disposed.add(namespace);

      const binding = this[SERVICE_CONTAINER_BINDINGS].get(namespace);
      if (
        binding != null &&
        binding.cached != null &&
        binding.cached.peek() !== NOT_RESOLVED &&
        binding.dispose != null
      ) {
        const value = binding.cached.peek();
        promises.push(Promise.resolve().then(() => binding.dispose!(value)));
      }
    }

    await Promise.allSettled(promises);

    for (const binding of this[SERVICE_CONTAINER_BINDINGS].values()) {
      if (binding.cached != null) {
        binding.cached.value = NOT_RESOLVED;
      }
    }

    if (this[SERVICE_CONTAINER_PARENT] != null) {
      if (!this[SERVICE_CONTAINER_PARENT][SERVICE_CONTAINER_DISPOSED]) {
        this[SERVICE_CONTAINER_PARENT].removeChild(this);
      }
      this[SERVICE_CONTAINER_PARENT] = null;
    }
  }

  /** Resolves a value by walking local bindings then the parent chain. */
  private resolve<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
  ): ServiceMap[Namespace] | undefined {
    const isTopLevel = this[SERVICE_CONTAINER_RESOLVING] == null;
    const resolving = this[SERVICE_CONTAINER_RESOLVING] ?? new Set<string>();

    if (isTopLevel) {
      this[SERVICE_CONTAINER_RESOLVING] = resolving;
    }

    try {
      return this.resolveWithSet(namespace, resolving);
    } finally {
      if (isTopLevel) {
        this[SERVICE_CONTAINER_RESOLVING] = null;
      }
    }
  }

  /** Resolves a namespace using the provided resolution set for cycle detection. */
  private resolveWithSet<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    resolving: Set<string>,
  ): ServiceMap[Namespace] | undefined {
    if (resolving.has(namespace)) {
      const chain = [...resolving, namespace].join(' → ');
      throw new ApplicationError({
        message: `Circular dependency detected while resolving "${namespace}": ${chain}`,
        code: 500,
        metadata: {namespace, chain: [...resolving, namespace]},
      });
    }

    const localBinding = this[SERVICE_CONTAINER_BINDINGS].get(namespace);

    if (localBinding != null) {
      return this.resolveBinding(localBinding, resolving) as ServiceMap[Namespace] | undefined;
    }

    if (
      this[SERVICE_CONTAINER_PARENT] != null &&
      !this[SERVICE_CONTAINER_PARENT][SERVICE_CONTAINER_DISPOSED]
    ) {
      return this.resolveFromParent(namespace, resolving);
    }

    return undefined;
  }

  /** Resolves a binding to its value based on its resolution strategy. */
  private resolveBinding<Value>(
    binding: InternalBinding<Value>,
    resolving: Set<string>,
  ): Value | undefined {
    if (binding.resolution === 'transient') {
      return this.invokeFactory(binding, resolving);
    }

    if (binding.cached!.peek() === NOT_RESOLVED) {
      binding.cached!.value = this.invokeFactory(binding, resolving) as Value | typeof NOT_RESOLVED;
      this[SERVICE_CONTAINER_RESOLUTION_ORDER].push(binding.namespace);
    }

    return binding.cached!.value as Value | undefined;
  }

  /** Resolves a namespace from the parent chain, handling scoped bindings. */
  private resolveFromParent<Namespace extends Extract<keyof ServiceMap, string>>(
    namespace: Namespace,
    resolving: Set<string>,
  ): ServiceMap[Namespace] | undefined {
    const parent = this[SERVICE_CONTAINER_PARENT]!;
    const parentBinding = parent.findBinding(namespace);

    if (parentBinding == null) {
      return undefined;
    }

    if (parentBinding.resolution === 'scoped') {
      const localBinding: InternalBinding = {
        namespace,
        factory: parentBinding.factory,
        resolution: 'scoped',
        cached: signal(NOT_RESOLVED),
        dispose: parentBinding.dispose,
      };
      this[SERVICE_CONTAINER_BINDINGS].set(namespace, localBinding);
      return this.resolveBinding(localBinding, resolving) as ServiceMap[Namespace] | undefined;
    }

    if (parentBinding.resolution === 'transient') {
      return this.invokeFactory(parentBinding, resolving) as ServiceMap[Namespace] | undefined;
    }

    // Singleton/value: delegate to parent with shared resolving set
    const previousResolving = parent[SERVICE_CONTAINER_RESOLVING];
    parent[SERVICE_CONTAINER_RESOLVING] = resolving;
    try {
      return parent.resolveWithSet(namespace, resolving) as ServiceMap[Namespace] | undefined;
    } finally {
      parent[SERVICE_CONTAINER_RESOLVING] = previousResolving;
    }
  }

  /** Invokes a binding's factory with cycle detection. */
  private invokeFactory<Value>(
    binding: InternalBinding<Value>,
    resolving: Set<string>,
  ): Value | undefined {
    resolving.add(binding.namespace);

    try {
      return binding.factory(this as Contracts.ReadonlyServiceContainer<ServiceMap>);
    } finally {
      resolving.delete(binding.namespace);
    }
  }

  /** Finds a binding by walking the local bindings then the parent chain. */
  private findBinding(namespace: string): InternalBinding | null {
    const local = this[SERVICE_CONTAINER_BINDINGS].get(namespace);
    if (local != null) {
      return local;
    }

    if (this[SERVICE_CONTAINER_PARENT] != null) {
      return this[SERVICE_CONTAINER_PARENT].findBinding(namespace);
    }

    return null;
  }

  /** Throws if the container is frozen or disposed. */
  private ensureWritable(): void {
    this.ensureNotDisposed();
    if (this[SERVICE_CONTAINER_FROZEN]) {
      throw new ApplicationError({
        message: 'Cannot modify a frozen service container.',
        code: 500,
      });
    }
  }

  /** Throws if the container has been disposed. */
  private ensureNotDisposed(): void {
    if (this[SERVICE_CONTAINER_DISPOSED]) {
      throw new ApplicationError({
        message: 'Cannot use a disposed service container.',
        code: 500,
      });
    }
  }
}
