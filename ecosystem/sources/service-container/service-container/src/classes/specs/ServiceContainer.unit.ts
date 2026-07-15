import {describe, expect, it, vi} from 'vitest';
import {SERVICE_CONTAINER_IDENTIFIER} from '../../constants';
import {ServiceContainer} from '../ServiceContainer';

interface TestServices {
  Logger: {log: (msg: string) => void};
  Config: {port: number};
  Database: {query: (sql: string) => string};
}

describe('ServiceContainer', () => {
  describe('construction and identity', () => {
    it('creates a container instance', () => {
      const container = new ServiceContainer<TestServices>();

      expect(container).toBeInstanceOf(ServiceContainer);
    });

    it('has SERVICE_CONTAINER_IDENTIFIER brand symbol', () => {
      const container = new ServiceContainer<TestServices>();

      expect(container[SERVICE_CONTAINER_IDENTIFIER]).toBe(true);
    });
  });

  describe('value()', () => {
    it('registers and resolves a pre-constructed value', () => {
      const container = new ServiceContainer<TestServices>();
      const logger = {log: vi.fn()};

      container.value('Logger', logger);

      expect(container.ensure('Logger')).toBe(logger);
    });

    it('returns the same reference on every resolution', () => {
      const container = new ServiceContainer<TestServices>();
      const logger = {log: vi.fn()};

      container.value('Logger', logger);

      expect(container.ensure('Logger')).toBe(container.ensure('Logger'));
    });

    it('returns this for fluent chaining', () => {
      const container = new ServiceContainer<TestServices>();

      const result = container.value('Logger', {log: vi.fn()});

      expect(result).toBe(container);
    });

    it('overwrites existing binding at the same namespace', () => {
      const container = new ServiceContainer<TestServices>();
      const first = {log: vi.fn()};
      const second = {log: vi.fn()};

      container.value('Logger', first);
      container.value('Logger', second);

      expect(container.ensure('Logger')).toBe(second);
    });
  });

  describe('singleton()', () => {
    it('lazily creates the value on first resolution', () => {
      const container = new ServiceContainer<TestServices>();
      const factory = vi.fn(() => ({log: vi.fn()}));

      container.singleton('Logger', factory);

      expect(factory).not.toHaveBeenCalled();

      container.ensure('Logger');

      expect(factory).toHaveBeenCalledOnce();
    });

    it('returns the same instance on subsequent resolutions', () => {
      const container = new ServiceContainer<TestServices>();
      container.singleton('Logger', () => ({log: vi.fn()}));

      const first = container.ensure('Logger');
      const second = container.ensure('Logger');

      expect(first).toBe(second);
    });

    it('passes the container to the factory', () => {
      const container = new ServiceContainer<TestServices>();
      const factory = vi.fn(() => ({log: vi.fn()}));

      container.singleton('Logger', factory);
      container.ensure('Logger');

      expect(factory).toHaveBeenCalledWith(container);
    });

    it('factory can resolve other services', () => {
      const container = new ServiceContainer<TestServices>();
      container.value('Config', {port: 3000});
      container.singleton('Logger', (c) => ({
        log: vi.fn((_msg: string) => c.ensure('Config').port.toString()),
      }));

      const logger = container.ensure('Logger');

      expect(logger.log('test')).toBe('3000');
    });
  });

  describe('scoped()', () => {
    it('creates a separate instance per scope', () => {
      const container = new ServiceContainer<TestServices>();
      container.scoped('Logger', () => ({log: vi.fn()}));

      const child1 = container.fork();
      const child2 = container.fork();

      const logger1 = child1.ensure('Logger');
      const logger2 = child2.ensure('Logger');

      expect(logger1).not.toBe(logger2);
    });

    it('caches the instance within the same scope', () => {
      const container = new ServiceContainer<TestServices>();
      container.scoped('Logger', () => ({log: vi.fn()}));

      const child = container.fork();

      expect(child.ensure('Logger')).toBe(child.ensure('Logger'));
    });

    it('passes the resolving container to the factory', () => {
      const container = new ServiceContainer<TestServices>();
      const factory = vi.fn(() => ({log: vi.fn()}));
      container.scoped('Logger', factory);

      const child = container.fork();
      child.ensure('Logger');

      expect(factory).toHaveBeenCalledWith(child);
    });

    it('resolves at the parent scope if resolved there', () => {
      const container = new ServiceContainer<TestServices>();
      const factory = vi.fn(() => ({log: vi.fn()}));
      container.scoped('Logger', factory);

      const parentLogger = container.ensure('Logger');
      const child = container.fork();
      const childLogger = child.ensure('Logger');

      expect(parentLogger).not.toBe(childLogger);
      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe('transient()', () => {
    it('creates a new instance on every resolution', () => {
      const container = new ServiceContainer<TestServices>();
      container.transient('Logger', () => ({log: vi.fn()}));

      const first = container.ensure('Logger');
      const second = container.ensure('Logger');

      expect(first).not.toBe(second);
    });

    it('passes the resolving container to the factory', () => {
      const container = new ServiceContainer<TestServices>();
      const factory = vi.fn(() => ({log: vi.fn()}));
      container.transient('Logger', factory);

      container.ensure('Logger');

      expect(factory).toHaveBeenCalledWith(container);
    });

    it('in a child, passes the child container to the factory', () => {
      const container = new ServiceContainer<TestServices>();
      const factory = vi.fn(() => ({log: vi.fn()}));
      container.transient('Logger', factory);

      const child = container.fork();
      child.ensure('Logger');

      expect(factory).toHaveBeenCalledWith(child);
    });
  });

  describe('ensure()', () => {
    it('throws when namespace is not registered', () => {
      const container = new ServiceContainer<TestServices>();

      expect(() => container.ensure('Logger')).toThrow(/not registered/);
    });

    it('resolves from parent chain', () => {
      const container = new ServiceContainer<TestServices>();
      const logger = {log: vi.fn()};
      container.value('Logger', logger);

      const child = container.fork();

      expect(child.ensure('Logger')).toBe(logger);
    });
  });

  describe('get()', () => {
    it('returns undefined when namespace is not registered', () => {
      const container = new ServiceContainer<TestServices>();

      expect(container.get('Logger')).toBeUndefined();
    });

    it('resolves when registered', () => {
      const container = new ServiceContainer<TestServices>();
      const logger = {log: vi.fn()};
      container.value('Logger', logger);

      expect(container.get('Logger')).toBe(logger);
    });
  });

  describe('getOr()', () => {
    it('returns fallback when namespace is not registered', () => {
      const container = new ServiceContainer<TestServices>();
      const fallback = {log: vi.fn()};

      expect(container.getOr('Logger', fallback)).toBe(fallback);
    });

    it('resolves when registered (ignores fallback)', () => {
      const container = new ServiceContainer<TestServices>();
      const logger = {log: vi.fn()};
      const fallback = {log: vi.fn()};
      container.value('Logger', logger);

      expect(container.getOr('Logger', fallback)).toBe(logger);
    });
  });

  describe('has() / missing()', () => {
    it('has() returns true for registered namespaces', () => {
      const container = new ServiceContainer<TestServices>();
      container.value('Logger', {log: vi.fn()});

      expect(container.has('Logger')).toBe(true);
    });

    it('has() returns false for unregistered namespaces', () => {
      const container = new ServiceContainer<TestServices>();

      expect(container.has('Logger')).toBe(false);
    });

    it('has() checks the parent chain', () => {
      const container = new ServiceContainer<TestServices>();
      container.value('Logger', {log: vi.fn()});
      const child = container.fork();

      expect(child.has('Logger')).toBe(true);
    });

    it('missing() is the inverse of has()', () => {
      const container = new ServiceContainer<TestServices>();

      expect(container.missing('Logger')).toBe(true);

      container.value('Logger', {log: vi.fn()});

      expect(container.missing('Logger')).toBe(false);
    });
  });

  describe('circular dependency detection', () => {
    it('throws on direct circular dependency', () => {
      const container = new ServiceContainer<TestServices>();
      container.singleton('Logger', (c) => {
        c.ensure('Logger');
        return {log: vi.fn()};
      });

      expect(() => container.ensure('Logger')).toThrow(/Circular dependency/);
    });

    it('throws on indirect circular dependency', () => {
      const container = new ServiceContainer<TestServices>();
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

    it('includes the chain in the error message', () => {
      const container = new ServiceContainer<TestServices>();
      container.singleton('Logger', (c) => {
        c.ensure('Config');
        return {log: vi.fn()};
      });
      container.singleton('Config', (c) => {
        c.ensure('Logger');
        return {port: 3000};
      });

      expect(() => container.ensure('Logger')).toThrow(/Logger → Config → Logger/);
    });

    it('does not leave stale state after failed resolution', () => {
      const container = new ServiceContainer<TestServices>();
      let shouldFail = true;

      container.singleton('Logger', (c) => {
        if (shouldFail) {
          c.ensure('Logger');
        }
        return {log: vi.fn()};
      });

      expect(() => container.ensure('Logger')).toThrow(/Circular dependency/);

      // After removing the circular dep, resolution should work
      shouldFail = false;
      container.singleton('Logger', () => ({log: vi.fn()}));

      expect(() => container.ensure('Logger')).not.toThrow();
    });
  });

  describe('fork()', () => {
    it('creates a child container', () => {
      const container = new ServiceContainer<TestServices>();
      const child = container.fork();

      expect(child).toBeInstanceOf(ServiceContainer);
      expect(child).not.toBe(container);
    });

    it('child inherits parent bindings', () => {
      const container = new ServiceContainer<TestServices>();
      const logger = {log: vi.fn()};
      container.value('Logger', logger);

      const child = container.fork();

      expect(child.ensure('Logger')).toBe(logger);
    });

    it('child sees bindings registered on parent AFTER fork (live-link)', () => {
      const container = new ServiceContainer<TestServices>();
      const child = container.fork();

      const logger = {log: vi.fn()};
      container.value('Logger', logger);

      expect(child.ensure('Logger')).toBe(logger);
    });

    it('child local bindings shadow parent without affecting parent', () => {
      const container = new ServiceContainer<TestServices>();
      const parentLogger = {log: vi.fn()};
      container.value('Logger', parentLogger);

      const child = container.fork();
      const childLogger = {log: vi.fn()};
      child.value('Logger', childLogger);

      expect(child.ensure('Logger')).toBe(childLogger);
      expect(container.ensure('Logger')).toBe(parentLogger);
    });

    it('accepts initial values', () => {
      const container = new ServiceContainer<TestServices>();
      const logger = {log: vi.fn()};

      const child = container.fork({Logger: logger});

      expect(child.ensure('Logger')).toBe(logger);
    });

    it('singleton resolved in parent is shared with child', () => {
      const container = new ServiceContainer<TestServices>();
      const factory = vi.fn(() => ({log: vi.fn()}));
      container.singleton('Logger', factory);

      const parentLogger = container.ensure('Logger');
      const child = container.fork();
      const childLogger = child.ensure('Logger');

      expect(childLogger).toBe(parentLogger);
      expect(factory).toHaveBeenCalledOnce();
    });

    it('singleton not yet resolved is resolved at parent scope', () => {
      const container = new ServiceContainer<TestServices>();
      const factory = vi.fn(() => ({log: vi.fn()}));
      container.singleton('Logger', factory);

      const child = container.fork();
      const childLogger = child.ensure('Logger');
      const parentLogger = container.ensure('Logger');

      expect(childLogger).toBe(parentLogger);
      expect(factory).toHaveBeenCalledOnce();
    });

    it('scoped bindings get independent instances per fork', () => {
      const container = new ServiceContainer<TestServices>();
      container.scoped('Logger', () => ({log: vi.fn()}));

      const child1 = container.fork();
      const child2 = container.fork();

      expect(child1.ensure('Logger')).not.toBe(child2.ensure('Logger'));
    });

    it('transient in child invokes factory with child container', () => {
      const container = new ServiceContainer<TestServices>();
      const factory = vi.fn(() => ({log: vi.fn()}));
      container.transient('Logger', factory);

      const child = container.fork();
      child.ensure('Logger');

      expect(factory).toHaveBeenCalledWith(child);
    });

    it('wires child as EventEmitter child (events bubble)', () => {
      const container = new ServiceContainer<TestServices>();
      const child = container.fork();
      const listener = vi.fn();

      (container as any).on('test:emitted', listener);
      (child as any).emit('test:emitted');

      expect(listener).toHaveBeenCalled();
    });

    it('grandchild resolves through full chain', () => {
      const container = new ServiceContainer<TestServices>();
      container.value('Logger', {log: vi.fn()});

      const child = container.fork();
      const grandchild = child.fork();

      expect(grandchild.ensure('Logger')).toBe(container.ensure('Logger'));
    });
  });

  describe('freeze()', () => {
    it('returns a readonly view', () => {
      const container = new ServiceContainer<TestServices>();
      const frozen = container.freeze();

      expect(frozen).toBe(container);
    });

    it('prevents set()', () => {
      const container = new ServiceContainer<TestServices>();
      container.freeze();

      expect(() =>
        container.set('Logger', {factory: () => ({log: vi.fn()}), resolution: 'value'}),
      ).toThrow(/frozen/);
    });

    it('prevents value()', () => {
      const container = new ServiceContainer<TestServices>();
      container.freeze();

      expect(() => container.value('Logger', {log: vi.fn()})).toThrow(/frozen/);
    });

    it('prevents singleton()', () => {
      const container = new ServiceContainer<TestServices>();
      container.freeze();

      expect(() => container.singleton('Logger', () => ({log: vi.fn()}))).toThrow(/frozen/);
    });

    it('prevents scoped()', () => {
      const container = new ServiceContainer<TestServices>();
      container.freeze();

      expect(() => container.scoped('Logger', () => ({log: vi.fn()}))).toThrow(/frozen/);
    });

    it('prevents transient()', () => {
      const container = new ServiceContainer<TestServices>();
      container.freeze();

      expect(() => container.transient('Logger', () => ({log: vi.fn()}))).toThrow(/frozen/);
    });

    it('allows read operations after freeze', () => {
      const container = new ServiceContainer<TestServices>();
      const logger = {log: vi.fn()};
      container.value('Logger', logger);
      container.freeze();

      expect(container.ensure('Logger')).toBe(logger);
      expect(container.get('Logger')).toBe(logger);
      expect(container.has('Logger')).toBe(true);
      expect(container.missing('Config')).toBe(true);
    });

    it('allows fork() on a frozen container', () => {
      const container = new ServiceContainer<TestServices>();
      container.value('Logger', {log: vi.fn()});
      container.freeze();

      const child = container.fork();

      expect(child.ensure('Logger')).toBe(container.ensure('Logger'));
      // child is not frozen
      expect(() => child.value('Config', {port: 3000})).not.toThrow();
    });
  });

  describe('dispose()', () => {
    it('calls disposers on resolved singleton bindings', async () => {
      const container = new ServiceContainer<TestServices>();
      const dispose = vi.fn();
      container.singleton('Logger', () => ({log: vi.fn()}), dispose);
      container.ensure('Logger');

      await container.dispose();

      expect(dispose).toHaveBeenCalledOnce();
    });

    it('calls disposers on resolved scoped bindings', async () => {
      const container = new ServiceContainer<TestServices>();
      const dispose = vi.fn();
      container.scoped('Logger', () => ({log: vi.fn()}), dispose);
      container.ensure('Logger');

      await container.dispose();

      expect(dispose).toHaveBeenCalledOnce();
    });

    it('does not call disposer if binding was never resolved', async () => {
      const container = new ServiceContainer<TestServices>();
      const dispose = vi.fn();
      container.singleton('Logger', () => ({log: vi.fn()}), dispose);

      await container.dispose();

      expect(dispose).not.toHaveBeenCalled();
    });

    it('throws on any method call after dispose', async () => {
      const container = new ServiceContainer<TestServices>();
      await container.dispose();

      expect(() => container.has('Logger')).toThrow(/disposed/);
      expect(() => container.ensure('Logger')).toThrow(/disposed/);
      expect(() => container.get('Logger')).toThrow(/disposed/);
      expect(() => container.value('Logger', {log: vi.fn()})).toThrow(/disposed/);
      expect(() => container.fork()).toThrow(/disposed/);
    });

    it('throws on double dispose', async () => {
      const container = new ServiceContainer<TestServices>();
      await container.dispose();

      await expect(container.dispose()).rejects.toThrow(/disposed/);
    });

    it('continues disposal even if one disposer fails', async () => {
      const container = new ServiceContainer<TestServices>();
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
  });

  describe('set()', () => {
    it('registers a binding from a descriptor', () => {
      const container = new ServiceContainer<TestServices>();
      const logger = {log: vi.fn()};

      container.set('Logger', {
        factory: () => logger,
        resolution: 'value',
      });

      expect(container.ensure('Logger')).toBe(logger);
    });

    it('returns this for fluent chaining', () => {
      const container = new ServiceContainer<TestServices>();

      const result = container.set('Logger', {
        factory: () => ({log: vi.fn()}),
        resolution: 'value',
      });

      expect(result).toBe(container);
    });

    it('overwrites existing binding and clears cached value for non-transient', () => {
      const container = new ServiceContainer<TestServices>();
      container.singleton('Logger', () => ({log: vi.fn()}));
      const first = container.ensure('Logger');

      container.singleton('Logger', () => ({log: vi.fn()}));
      const second = container.ensure('Logger');

      expect(first).not.toBe(second);
    });
  });

  describe('signal-based caching', () => {
    it('re-registering a value binding updates the resolved value', () => {
      const container = new ServiceContainer<TestServices>();
      const first = {log: vi.fn()};
      const second = {log: vi.fn()};

      container.value('Logger', first);
      expect(container.ensure('Logger')).toBe(first);

      container.value('Logger', second);
      expect(container.ensure('Logger')).toBe(second);
    });

    it('re-registering a singleton clears the cache', () => {
      const container = new ServiceContainer<TestServices>();
      container.singleton('Logger', () => ({log: vi.fn()}));
      const first = container.ensure('Logger');

      container.singleton('Logger', () => ({log: vi.fn()}));
      const second = container.ensure('Logger');

      expect(first).not.toBe(second);
    });
  });

  describe('undefined-valued services', () => {
    it('singleton factory returning undefined is cached (not re-invoked)', () => {
      const container = new ServiceContainer<{Optional: undefined}>();
      const factory = vi.fn(() => undefined);
      container.singleton('Optional', factory);

      container.ensure('Optional');
      container.ensure('Optional');

      expect(factory).toHaveBeenCalledOnce();
    });

    it('scoped factory returning undefined is cached per scope', () => {
      const container = new ServiceContainer<{Optional: undefined}>();
      const factory = vi.fn(() => undefined);
      container.scoped('Optional', factory);

      const child = container.fork();
      child.ensure('Optional');
      child.ensure('Optional');

      expect(factory).toHaveBeenCalledOnce();
    });

    it('disposer is called for binding resolved to undefined', async () => {
      const container = new ServiceContainer<{Optional: undefined}>();
      const dispose = vi.fn();
      container.singleton('Optional', () => undefined, dispose);
      container.ensure('Optional');

      await container.dispose();

      expect(dispose).toHaveBeenCalledWith(undefined);
    });
  });

  describe('dispose lifecycle', () => {
    it('disposes in reverse-resolution order', async () => {
      const container = new ServiceContainer<TestServices>();
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

      // Logger depends on Config, so Config resolves first
      container.ensure('Logger');

      await container.dispose();

      // Logger resolved after Config, so Logger is disposed first (reverse order)
      expect(order).toEqual(['Logger', 'Config']);
    });

    it('detaches from parent EventEmitter on dispose', async () => {
      const parent = new ServiceContainer<TestServices>();
      const child = parent.fork();
      const listener = vi.fn();

      (parent as any).on('test:emitted', listener);

      // Before dispose: child events bubble to parent
      (child as any).emit('test:emitted');
      expect(listener).toHaveBeenCalledTimes(1);

      await child.dispose();

      // After dispose: child is detached, parent can't be reached
      // Any call on disposed child throws
      expect(() => (child as any).emit('test:emitted')).toThrow(/disposed/);
    });

    it('inherited event methods throw after dispose', async () => {
      const container = new ServiceContainer<TestServices>();
      await container.dispose();

      expect(() => (container as any).on('test:emitted', () => {})).toThrow(/disposed/);
      expect(() => (container as any).once('test:emitted', () => {})).toThrow(/disposed/);
      expect(() => (container as any).off('test:emitted', () => {})).toThrow(/disposed/);
      expect(() => (container as any).emit('test:emitted')).toThrow(/disposed/);
      expect(() => container.addChild(new ServiceContainer())).toThrow(/disposed/);
      expect(() => container.removeChild(new ServiceContainer())).toThrow(/disposed/);
    });
  });

  describe('cross-container circular dependency', () => {
    it('detects cycles that span parent-child containers', () => {
      const parent = new ServiceContainer<TestServices>();
      parent.singleton('Logger', (c) => {
        c.ensure('Config');
        return {log: vi.fn()};
      });
      parent.singleton('Config', (c) => {
        c.ensure('Logger');
        return {port: 3000};
      });

      const child = parent.fork();

      expect(() => child.ensure('Logger')).toThrow(/Circular dependency/);
    });

    it('includes the full chain in the error message across containers', () => {
      const parent = new ServiceContainer<TestServices>();
      parent.singleton('Logger', (c) => {
        c.ensure('Config');
        return {log: vi.fn()};
      });
      parent.singleton('Config', (c) => {
        c.ensure('Logger');
        return {port: 3000};
      });

      const child = parent.fork();

      expect(() => child.ensure('Logger')).toThrow(/Logger.*Config.*Logger/);
    });
  });

  describe('child independence after parent dispose', () => {
    it('child can dispose after parent is already disposed', async () => {
      const parent = new ServiceContainer<TestServices>();
      const child = parent.fork();
      child.value('Logger', {log: vi.fn()});

      await parent.dispose();

      await expect(child.dispose()).resolves.toBeUndefined();
    });

    it('child has() returns false for parent bindings after parent dispose', async () => {
      const parent = new ServiceContainer<TestServices>();
      parent.value('Logger', {log: vi.fn()});
      const child = parent.fork();

      expect(child.has('Logger')).toBe(true);

      await parent.dispose();

      expect(child.has('Logger')).toBe(false);
    });

    it('child can still resolve its own local bindings after parent dispose', async () => {
      const parent = new ServiceContainer<TestServices>();
      const child = parent.fork();
      const logger = {log: vi.fn()};
      child.value('Logger', logger);

      await parent.dispose();

      expect(child.ensure('Logger')).toBe(logger);
    });
  });

  describe('re-registration disposal', () => {
    it('disposer is called only once when binding is re-registered', async () => {
      const container = new ServiceContainer<TestServices>();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();

      container.singleton('Logger', () => ({log: vi.fn()}), dispose1);
      container.ensure('Logger');

      container.singleton('Logger', () => ({log: vi.fn()}), dispose2);
      container.ensure('Logger');

      await container.dispose();

      // Only the latest disposer should be called, and only once
      expect(dispose2).toHaveBeenCalledOnce();
    });
  });
});
