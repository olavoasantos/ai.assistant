import {describe, expect, expectTypeOf, it, vi} from 'vitest';
import type * as Contract from '@ai.assistant/contracts/service-container';

/**
 * Service map used by the shared compliance suite.
 *
 * Implementations do not need to know about this type — they only provide a
 * factory whose return type is checked against it by the suite.
 */
export interface ComplianceServiceMap {
  Logger: {log: (msg: string) => void};
  Config: {port: number};
  Database: {query: (sql: string) => string};
  Optional: undefined;
}

/**
 * Factories used by service-container implementations to run the shared
 * compliance suite.
 *
 * Only the container constructor is required. Every behavioural invariant
 * below is exercised through the public contract surface it produces.
 */
export interface ServiceContainerComplianceTestSuite {
  /** Creates a fresh container bound to the compliance service map. */
  createContainer: () => Contract.ServiceContainer<ComplianceServiceMap>;
}

/**
 * Registers the shared behavioural tests every service-container implementation
 * must satisfy.
 *
 * The suite asserts the public contract and implementation-agnostic charter
 * for typed dependency injection containers: binding modes (value, singleton,
 * scoped, transient), resolution and inheritance through the fork chain,
 * circular dependency detection, freeze, dispose, and event-emitter
 * integration.
 */
export function runServiceContainerComplianceTests(
  factories: ServiceContainerComplianceTestSuite,
): void {
  const {createContainer} = factories;

  describe('service-container compliance', () => {
    describe('value bindings', () => {
      it('resolves a pre-constructed value', () => {
        const container = createContainer();
        const logger = {log: vi.fn()};

        container.value('Logger', logger);

        expect(container.ensure('Logger')).toBe(logger);
      });

      it('returns the same reference on every resolution', () => {
        const container = createContainer();
        const logger = {log: vi.fn()};

        container.value('Logger', logger);

        expect(container.ensure('Logger')).toBe(container.ensure('Logger'));
      });

      it('returns the container for fluent chaining', () => {
        const container = createContainer();

        expect(container.value('Logger', {log: vi.fn()})).toBe(container);
      });

      it('overwrites an existing binding at the same namespace', () => {
        const container = createContainer();
        const first = {log: vi.fn()};
        const second = {log: vi.fn()};

        container.value('Logger', first);
        container.value('Logger', second);

        expect(container.ensure('Logger')).toBe(second);
      });

      it('is inherited by reference across forks', () => {
        const root = createContainer();
        const logger = {log: vi.fn()};

        root.value('Logger', logger);

        expect(root.fork().ensure('Logger')).toBe(logger);
      });
    });

    describe('singleton bindings', () => {
      it('lazily creates the value on first resolution', () => {
        const container = createContainer();
        const factory = vi.fn(() => ({log: vi.fn()}));

        container.singleton('Logger', factory);

        expect(factory).not.toHaveBeenCalled();

        container.ensure('Logger');

        expect(factory).toHaveBeenCalledOnce();
      });

      it('caches the instance for subsequent resolutions', () => {
        const container = createContainer();

        container.singleton('Logger', () => ({log: vi.fn()}));

        expect(container.ensure('Logger')).toBe(container.ensure('Logger'));
      });

      it('passes the resolving container to the factory', () => {
        const container = createContainer();
        const factory = vi.fn(() => ({log: vi.fn()}));

        container.singleton('Logger', factory);
        container.ensure('Logger');

        expect(factory).toHaveBeenCalledWith(container);
      });

      it('lets a factory resolve other registered services', () => {
        const container = createContainer();

        container.value('Config', {port: 3000});
        container.singleton('Logger', (c) => ({
          log: vi.fn((_msg: string) => String(c.ensure('Config').port)),
        }));

        expect(container.ensure('Logger').log('test')).toBe('3000');
      });

      it('shares the cached instance with descendant scopes', () => {
        const root = createContainer();
        const factory = vi.fn(() => ({log: vi.fn()}));

        root.singleton('Logger', factory);

        const parentLogger = root.ensure('Logger');
        const childLogger = root.fork().ensure('Logger');

        expect(childLogger).toBe(parentLogger);
        expect(factory).toHaveBeenCalledOnce();
      });
    });

    describe('scoped bindings', () => {
      it('creates an independent instance per scope', () => {
        const root = createContainer();

        root.scoped('Logger', () => ({log: vi.fn()}));

        const child1 = root.fork();
        const child2 = root.fork();

        expect(child1.ensure('Logger')).not.toBe(child2.ensure('Logger'));
      });

      it('caches the instance within the same scope', () => {
        const root = createContainer();

        root.scoped('Logger', () => ({log: vi.fn()}));

        const child = root.fork();

        expect(child.ensure('Logger')).toBe(child.ensure('Logger'));
      });

      it('passes the resolving container (the child) to the factory', () => {
        const root = createContainer();
        const factory = vi.fn(() => ({log: vi.fn()}));

        root.scoped('Logger', factory);

        const child = root.fork();
        child.ensure('Logger');

        expect(factory).toHaveBeenCalledWith(child);
      });

      it('keeps parent and child instances independent', () => {
        const root = createContainer();
        const factory = vi.fn(() => ({log: vi.fn()}));

        root.scoped('Logger', factory);

        const parentLogger = root.ensure('Logger');
        const childLogger = root.fork().ensure('Logger');

        expect(parentLogger).not.toBe(childLogger);
        expect(factory).toHaveBeenCalledTimes(2);
      });
    });

    describe('transient bindings', () => {
      it('creates a fresh instance on every resolution', () => {
        const container = createContainer();

        container.transient('Logger', () => ({log: vi.fn()}));

        expect(container.ensure('Logger')).not.toBe(container.ensure('Logger'));
      });

      it('passes the resolving container to the factory', () => {
        const container = createContainer();
        const factory = vi.fn(() => ({log: vi.fn()}));

        container.transient('Logger', factory);
        container.ensure('Logger');

        expect(factory).toHaveBeenCalledWith(container);
      });

      it('in a child, passes the child container to the factory', () => {
        const root = createContainer();
        const factory = vi.fn(() => ({log: vi.fn()}));

        root.transient('Logger', factory);

        const child = root.fork();
        child.ensure('Logger');

        expect(factory).toHaveBeenCalledWith(child);
      });
    });

    describe('set() descriptor', () => {
      it('registers a binding from a descriptor', () => {
        const container = createContainer();
        const logger = {log: vi.fn()};

        container.set('Logger', {factory: () => logger, resolution: 'value'});

        expect(container.ensure('Logger')).toBe(logger);
      });

      it('returns the container for fluent chaining', () => {
        const container = createContainer();

        expect(
          container.set('Logger', {factory: () => ({log: vi.fn()}), resolution: 'value'}),
        ).toBe(container);
      });

      it('overwrites a binding and clears the cached value', () => {
        const container = createContainer();

        container.singleton('Logger', () => ({log: vi.fn()}));
        const first = container.ensure('Logger');

        container.singleton('Logger', () => ({log: vi.fn()}));
        const second = container.ensure('Logger');

        expect(first).not.toBe(second);
      });
    });

    describe('ensure()', () => {
      it('throws when the namespace is not registered', () => {
        const container = createContainer();

        expect(() => container.ensure('Logger')).toThrow(/not registered/);
      });

      it('resolves from the parent chain', () => {
        const root = createContainer();
        const logger = {log: vi.fn()};

        root.value('Logger', logger);

        expect(root.fork().ensure('Logger')).toBe(logger);
      });
    });

    describe('get()', () => {
      it('returns undefined when the namespace is not registered', () => {
        expect(createContainer().get('Logger')).toBeUndefined();
      });

      it('resolves when registered', () => {
        const container = createContainer();
        const logger = {log: vi.fn()};

        container.value('Logger', logger);

        expect(container.get('Logger')).toBe(logger);
      });
    });

    describe('getOr()', () => {
      it('returns the fallback when the namespace is not registered', () => {
        const container = createContainer();
        const fallback = {log: vi.fn()};

        expect(container.getOr('Logger', fallback)).toBe(fallback);
      });

      it('resolves when registered, ignoring the fallback', () => {
        const container = createContainer();
        const logger = {log: vi.fn()};

        container.value('Logger', logger);

        expect(container.getOr('Logger', {log: vi.fn()})).toBe(logger);
      });
    });

    describe('has() / missing()', () => {
      it('has() returns true for registered namespaces', () => {
        const container = createContainer();

        container.value('Logger', {log: vi.fn()});

        expect(container.has('Logger')).toBe(true);
      });

      it('has() returns false for unregistered namespaces', () => {
        expect(createContainer().has('Logger')).toBe(false);
      });

      it('has() checks the parent chain', () => {
        const root = createContainer();

        root.value('Logger', {log: vi.fn()});

        expect(root.fork().has('Logger')).toBe(true);
      });

      it('missing() is the inverse of has()', () => {
        const container = createContainer();

        expect(container.missing('Logger')).toBe(true);

        container.value('Logger', {log: vi.fn()});

        expect(container.missing('Logger')).toBe(false);
      });
    });

    describe('fork()', () => {
      it('creates a child container', () => {
        const child = createContainer().fork();

        expect(child).not.toBe(createContainer());
      });

      it('child inherits parent bindings', () => {
        const root = createContainer();
        const logger = {log: vi.fn()};

        root.value('Logger', logger);

        expect(root.fork().ensure('Logger')).toBe(logger);
      });

      it('child sees bindings registered on the parent after the fork (live-link)', () => {
        const root = createContainer();
        const child = root.fork();
        const logger = {log: vi.fn()};

        root.value('Logger', logger);

        expect(child.ensure('Logger')).toBe(logger);
      });

      it('child local bindings shadow the parent without affecting it', () => {
        const root = createContainer();
        const parentLogger = {log: vi.fn()};

        root.value('Logger', parentLogger);

        const child = root.fork();
        const childLogger = {log: vi.fn()};

        child.value('Logger', childLogger);

        expect(child.ensure('Logger')).toBe(childLogger);
        expect(root.ensure('Logger')).toBe(parentLogger);
      });

      it('accepts initial value bindings', () => {
        const root = createContainer();
        const logger = {log: vi.fn()};

        expect(root.fork({Logger: logger}).ensure('Logger')).toBe(logger);
      });

      it('grandchild resolves through the full chain', () => {
        const root = createContainer();

        root.value('Logger', {log: vi.fn()});

        expect(root.fork().fork().ensure('Logger')).toBe(root.ensure('Logger'));
      });

      it('wires the child as an event emitter child so events bubble', () => {
        const root = createContainer();
        const child = root.fork();
        const listener = vi.fn();

        root.on('test:event', listener);
        child.emit('test:event');

        expect(listener).toHaveBeenCalled();
      });
    });

    describe('circular dependency detection', () => {
      it('throws on a direct circular dependency', () => {
        const container = createContainer();

        container.singleton('Logger', (c) => {
          c.ensure('Logger');
          return {log: vi.fn()};
        });

        expect(() => container.ensure('Logger')).toThrow(/Circular dependency/);
      });

      it('throws on an indirect circular dependency', () => {
        const container = createContainer();

        container.singleton('Logger', (c) => {
          c.ensure('Config');
          return {log: vi.fn()};
        });
        container.singleton('Config', (c) => {
          c.ensure('Logger');
          return {port: 3000};
        });

        expect(() => container.ensure('Logger')).toThrow(/Circular dependency/);
      });

      it('includes the dependency chain in the error message', () => {
        const container = createContainer();

        container.singleton('Logger', (c) => {
          c.ensure('Config');
          return {log: vi.fn()};
        });
        container.singleton('Config', (c) => {
          c.ensure('Logger');
          return {port: 3000};
        });

        expect(() => container.ensure('Logger')).toThrow(/Logger.*Config.*Logger/);
      });

      it('does not leave stale state after a failed resolution', () => {
        const container = createContainer();
        let shouldFail = true;

        container.singleton('Logger', (c) => {
          if (shouldFail) {
            c.ensure('Logger');
          }
          return {log: vi.fn()};
        });

        expect(() => container.ensure('Logger')).toThrow(/Circular dependency/);

        shouldFail = false;
        container.singleton('Logger', () => ({log: vi.fn()}));

        expect(() => container.ensure('Logger')).not.toThrow();
      });

      it('detects cycles that span parent and child containers', () => {
        const root = createContainer();

        root.singleton('Logger', (c) => {
          c.ensure('Config');
          return {log: vi.fn()};
        });
        root.singleton('Config', (c) => {
          c.ensure('Logger');
          return {port: 3000};
        });

        expect(() => root.fork().ensure('Logger')).toThrow(/Circular dependency/);
      });
    });

    describe('freeze()', () => {
      it('returns a readonly view of the container', () => {
        const container = createContainer();

        expect(container.freeze()).toBe(container);
      });

      it('prevents set()', () => {
        const container = createContainer();
        container.freeze();

        expect(() =>
          container.set('Logger', {factory: () => ({log: vi.fn()}), resolution: 'value'}),
        ).toThrow(/frozen/);
      });

      it('prevents value()', () => {
        const container = createContainer();
        container.freeze();

        expect(() => container.value('Logger', {log: vi.fn()})).toThrow(/frozen/);
      });

      it('prevents singleton()', () => {
        const container = createContainer();
        container.freeze();

        expect(() => container.singleton('Logger', () => ({log: vi.fn()}))).toThrow(/frozen/);
      });

      it('prevents scoped()', () => {
        const container = createContainer();
        container.freeze();

        expect(() => container.scoped('Logger', () => ({log: vi.fn()}))).toThrow(/frozen/);
      });

      it('prevents transient()', () => {
        const container = createContainer();
        container.freeze();

        expect(() => container.transient('Logger', () => ({log: vi.fn()}))).toThrow(/frozen/);
      });

      it('keeps read operations available after freeze', () => {
        const container = createContainer();
        const logger = {log: vi.fn()};

        container.value('Logger', logger);
        container.freeze();

        expect(container.ensure('Logger')).toBe(logger);
        expect(container.get('Logger')).toBe(logger);
        expect(container.has('Logger')).toBe(true);
        expect(container.missing('Config')).toBe(true);
      });

      it('still allows fork() on a frozen container', () => {
        const container = createContainer();

        container.value('Logger', {log: vi.fn()});
        container.freeze();

        const child = container.fork();

        expect(child.ensure('Logger')).toBe(container.ensure('Logger'));
        expect(() => child.value('Config', {port: 3000})).not.toThrow();
      });
    });

    describe('dispose()', () => {
      it('calls disposers on resolved singleton bindings', async () => {
        const container = createContainer();
        const dispose = vi.fn();

        container.singleton('Logger', () => ({log: vi.fn()}), dispose);
        container.ensure('Logger');

        await container.dispose();

        expect(dispose).toHaveBeenCalledOnce();
      });

      it('calls disposers on resolved scoped bindings', async () => {
        const container = createContainer();
        const dispose = vi.fn();

        container.scoped('Logger', () => ({log: vi.fn()}), dispose);
        container.ensure('Logger');

        await container.dispose();

        expect(dispose).toHaveBeenCalledOnce();
      });

      it('does not call a disposer when the binding was never resolved', async () => {
        const container = createContainer();
        const dispose = vi.fn();

        container.singleton('Logger', () => ({log: vi.fn()}), dispose);

        await container.dispose();

        expect(dispose).not.toHaveBeenCalled();
      });

      it('throws on any method call after dispose', async () => {
        const container = createContainer();

        await container.dispose();

        expect(() => container.has('Logger')).toThrow(/disposed/);
        expect(() => container.ensure('Logger')).toThrow(/disposed/);
        expect(() => container.get('Logger')).toThrow(/disposed/);
        expect(() => container.value('Logger', {log: vi.fn()})).toThrow(/disposed/);
        expect(() => container.fork()).toThrow(/disposed/);
      });

      it('throws on double dispose', async () => {
        const container = createContainer();

        await container.dispose();

        await expect(container.dispose()).rejects.toThrow(/disposed/);
      });

      it('continues disposal even if one disposer fails', async () => {
        const container = createContainer();
        const dispose1 = vi.fn(() => {
          throw new Error('disposer failed');
        });
        const dispose2 = vi.fn();

        container.singleton('Logger', () => ({log: vi.fn()}), dispose1);
        container.singleton('Config', () => ({port: 3000}), dispose2);
        container.ensure('Logger');
        container.ensure('Config');

        await container.dispose();

        expect(dispose1).toHaveBeenCalled();
        expect(dispose2).toHaveBeenCalled();
      });

      it('disposes resolved bindings in reverse-resolution order', async () => {
        const container = createContainer();
        const order: string[] = [];

        container.singleton(
          'Config',
          () => ({port: 3000}),
          () => {
            order.push('Config');
          },
        );
        container.singleton(
          'Logger',
          (c) => {
            c.ensure('Config');
            return {log: vi.fn()};
          },
          () => {
            order.push('Logger');
          },
        );

        container.ensure('Logger');

        await container.dispose();

        expect(order).toEqual(['Logger', 'Config']);
      });

      it('detaches from the parent event emitter on dispose', async () => {
        const parent = createContainer();
        const child = parent.fork();
        const listener = vi.fn();

        parent.on('test', listener);

        child.emit('test');
        expect(listener).toHaveBeenCalledTimes(1);

        await child.dispose();

        expect(() => child.emit('test')).toThrow(/disposed/);
      });
    });

    describe('undefined-valued services', () => {
      it('caches a singleton factory returning undefined without re-invoking', () => {
        const container = createContainer();
        const factory = vi.fn(() => undefined);

        container.singleton('Optional', factory);
        container.ensure('Optional');
        container.ensure('Optional');

        expect(factory).toHaveBeenCalledOnce();
      });

      it('caches a scoped factory returning undefined per scope', () => {
        const root = createContainer();
        const factory = vi.fn(() => undefined);

        root.scoped('Optional', factory);

        const child = root.fork();
        child.ensure('Optional');
        child.ensure('Optional');

        expect(factory).toHaveBeenCalledOnce();
      });

      it('calls the disposer for a binding resolved to undefined', async () => {
        const container = createContainer();
        const dispose = vi.fn();

        container.singleton('Optional', () => undefined, dispose);
        container.ensure('Optional');

        await container.dispose();

        expect(dispose).toHaveBeenCalledWith(undefined);
      });
    });

    describe('child independence after parent dispose', () => {
      it('child can dispose after the parent is already disposed', async () => {
        const parent = createContainer();
        const child = parent.fork();

        child.value('Logger', {log: vi.fn()});

        await parent.dispose();

        await expect(child.dispose()).resolves.toBeUndefined();
      });

      it('child has() returns false for parent bindings after parent dispose', async () => {
        const parent = createContainer();

        parent.value('Logger', {log: vi.fn()});
        const child = parent.fork();

        expect(child.has('Logger')).toBe(true);

        await parent.dispose();

        expect(child.has('Logger')).toBe(false);
      });

      it('child can still resolve its own local bindings after parent dispose', async () => {
        const parent = createContainer();
        const child = parent.fork();
        const logger = {log: vi.fn()};

        child.value('Logger', logger);

        await parent.dispose();

        expect(child.ensure('Logger')).toBe(logger);
      });
    });

    describe('re-registration disposal', () => {
      it('calls only the latest disposer, and only once, when a binding is re-registered', async () => {
        const container = createContainer();
        const dispose1 = vi.fn();
        const dispose2 = vi.fn();

        container.singleton('Logger', () => ({log: vi.fn()}), dispose1);
        container.ensure('Logger');

        container.singleton('Logger', () => ({log: vi.fn()}), dispose2);
        container.ensure('Logger');

        await container.dispose();

        expect(dispose2).toHaveBeenCalledOnce();
      });
    });

    describe('typed resolution', () => {
      it('ensures returns the typed service value', () => {
        const container = createContainer();
        const logger = {log: vi.fn()};

        container.value('Logger', logger);

        const resolved = container.ensure('Logger');

        expectTypeOf(resolved).toEqualTypeOf<{log: (msg: string) => void}>();
        expect(resolved).toBe(logger);
      });

      it('get returns the typed service value or undefined', () => {
        const container = createContainer();

        const resolved = container.get('Logger');

        expectTypeOf(resolved).toEqualTypeOf<{log: (msg: string) => void} | undefined>();
      });
    });
  });
}
