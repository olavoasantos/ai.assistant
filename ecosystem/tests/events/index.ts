import {describe, expect, expectTypeOf, it, vi} from 'vitest';
import type * as Contract from '@ai.assistant/contracts/events';

/**
 * Event map used by the shared compliance suite.
 *
 * Implementations do not need to know about this type — they only provide
 * factory functions whose return types are checked against it by the suite.
 */
export interface ComplianceEventMap {
  'action:start': {actorId: string};
  'action:end': {actorId: string; success: boolean};
  tick: undefined;
  status: string | undefined;
}

/**
 * Factories used by event implementations to run the shared compliance suite.
 *
 * Only the two foundational constructors are required: the emitter and the
 * event. Every behavioural invariant below is exercised through the public
 * contract surface they produce.
 */
export interface EventComplianceTestSuite {
  /** Creates a fresh emitter bound to the compliance event map. */
  createEmitter: () => Contract.EventEmitter<ComplianceEventMap>;

  /** Creates a branded event instance for the `emit(event)` overload. */
  createEvent: <Type extends Extract<keyof ComplianceEventMap, string>>(
    ...args: Contract.EventArgs<Type, ComplianceEventMap[Type]>
  ) => Contract.Event<Type, ComplianceEventMap[Type]>;
}

/**
 * Registers the shared behavioural tests every event implementation must
 * satisfy.
 *
 * The suite asserts the public contract and implementation-agnostic charter for
 * bubbling event emitters: dispatch lifecycle, typed payloads, listener
 * registration and ordering, glob matching, parent-child bubbling, propagation
 * control, and identity-based rejection of structural look-alikes.
 */
export function runEventComplianceTests(factories: EventComplianceTestSuite): void {
  const {createEmitter, createEvent} = factories;

  describe('event compliance', () => {
    describe('dispatch lifecycle', () => {
      it('dispatches to matching listeners with typed details', () => {
        const emitter = createEmitter();
        const listener = vi.fn();

        emitter.on('action:start', (event) => {
          expectTypeOf(event.type).toEqualTypeOf<'action:start'>();
          expectTypeOf(event.details).toEqualTypeOf<{actorId: string}>();
          listener(event.details.actorId);
        });

        const event = emitter.emit('action:start', {details: {actorId: 'a-1'}});

        expect(listener).toHaveBeenCalledWith('a-1');
        expect(event.type).toBe('action:start');
        expect(event.details).toEqual({actorId: 'a-1'});
        expect(event.origin).toBe(emitter);
        expect(event.currentEmitter).toBeNull();
        expect(event.propagationPath()).toEqual([emitter]);
      });

      it('emits silently when no listeners are registered', () => {
        const emitter = createEmitter();

        const event = emitter.emit('action:start', {details: {actorId: 'a-1'}});

        expect(event.type).toBe('action:start');
        expect(event.propagationPath()).toEqual([emitter]);
      });

      it('allows omitting options when the payload type is undefined', () => {
        const emitter = createEmitter();
        const listener = vi.fn();

        emitter.on('tick', (event) => {
          expectTypeOf(event.details).toEqualTypeOf<undefined>();
          listener(event.details);
        });

        const event = emitter.emit('tick');

        expect(listener).toHaveBeenCalledWith(undefined);
        expect(event.details).toBeUndefined();
      });

      it('still requires options when the payload union includes undefined', () => {
        const emitter = createEmitter();

        // @ts-expect-error union payloads still require explicit emit options
        const invalidEmit = () => emitter.emit('status');

        expectTypeOf(invalidEmit).toEqualTypeOf<
          () => Contract.Event<'status', string | undefined>
        >();
      });

      it('marks an event as dispatched so it cannot be re-emitted', () => {
        const emitter = createEmitter();
        const event = createEvent('action:start', {details: {actorId: 'a-1'}});

        emitter.emit(event);

        expect(() => {
          emitter.emit(event);
        }).toThrow();
      });

      it('rejects re-emitting a dispatched event on a different emitter', () => {
        const first = createEmitter();
        const second = createEmitter();
        const event = createEvent('action:start', {details: {actorId: 'a-1'}});

        first.emit(event);

        expect(() => {
          second.emit(event);
        }).toThrow();
      });

      it('resets dispatch state and re-throws the first error when a listener throws', () => {
        const emitter = createEmitter();
        const event = createEvent('action:start', {details: {actorId: 'a-1'}});
        const cause = new Error('boom');
        const calls: string[] = [];

        emitter.on('action:start', () => {
          calls.push('first');
          throw cause;
        });
        emitter.on('action:start', () => {
          calls.push('second');
        });

        expect(() => {
          emitter.emit(event);
        }).toThrow(cause);

        expect(calls).toEqual(['first', 'second']);
        expect(event.origin).toBe(emitter);
        expect(event.currentEmitter).toBeNull();

        expect(() => {
          emitter.emit(event);
        }).toThrow();
      });
    });

    describe('listener registration', () => {
      it('removes listeners through the cleanup function returned by on', () => {
        const emitter = createEmitter();
        const listener = vi.fn();
        const cleanup = emitter.on('action:start', listener);

        cleanup();
        emitter.emit('action:start', {details: {actorId: 'a-1'}});

        expect(listener).not.toHaveBeenCalled();
      });

      it('tolerates cleanup functions being called multiple times', () => {
        const emitter = createEmitter();
        const listener = vi.fn();
        const cleanup = emitter.on('action:start', listener);

        cleanup();
        expect(() => cleanup()).not.toThrow();

        emitter.emit('action:start', {details: {actorId: 'a-1'}});
        expect(listener).not.toHaveBeenCalled();
      });

      it('removes listeners through off and ignores unregistered ones', () => {
        const emitter = createEmitter();
        const listener = vi.fn();
        const unregistered = vi.fn();

        emitter.on('action:start', listener);

        expect(() => {
          emitter.off('action:start', unregistered);
        }).not.toThrow();

        emitter.emit('action:start', {details: {actorId: 'a-1'}});

        expect(listener).toHaveBeenCalledTimes(1);
        expect(unregistered).not.toHaveBeenCalled();
      });

      it('ignores duplicate registrations keeping the first registration mode', () => {
        const emitter = createEmitter();
        const persistent = vi.fn();
        const oneShot = vi.fn();

        emitter.on('action:start', persistent);
        emitter.once('action:start', persistent);
        emitter.once('action:end', oneShot);
        emitter.on('action:end', oneShot);

        emitter.emit('action:start', {details: {actorId: 'a-1'}});
        emitter.emit('action:start', {details: {actorId: 'a-1'}});
        emitter.emit('action:end', {details: {actorId: 'a-1', success: true}});
        emitter.emit('action:end', {details: {actorId: 'a-1', success: true}});

        expect(persistent).toHaveBeenCalledTimes(2);
        expect(oneShot).toHaveBeenCalledTimes(1);
      });

      it('preserves listener order across exact and glob registrations', () => {
        const emitter = createEmitter();
        const calls: string[] = [];

        emitter.on('action:start', () => {
          calls.push('exact:first');
        });
        emitter.on('action:*', () => {
          calls.push('glob:second');
        });
        emitter.on('action:start', () => {
          calls.push('exact:third');
        });

        emitter.emit('action:start', {details: {actorId: 'a-1'}});

        expect(calls).toEqual(['exact:first', 'glob:second', 'exact:third']);
      });

      it('removes once listeners before their first invocation even when they throw', () => {
        const emitter = createEmitter();
        const listener = vi.fn(() => {
          throw new Error('boom');
        });

        emitter.once('action:start', listener);

        expect(() => {
          emitter.emit('action:start', {details: {actorId: 'a-1'}});
        }).toThrow('boom');
        expect(() => {
          emitter.emit('action:start', {details: {actorId: 'a-1'}});
        }).not.toThrow();

        expect(listener).toHaveBeenCalledTimes(1);
      });

      it('does not fire listeners added during dispatch but still fires those removed mid-dispatch', () => {
        const emitter = createEmitter();
        const calls: string[] = [];
        const second = vi.fn(() => {
          calls.push('second');
        });

        emitter.on('action:start', () => {
          calls.push('first');
          emitter.off('action:start', second);
          emitter.on('action:start', () => {
            calls.push('late');
          });
        });
        emitter.on('action:start', second);

        emitter.emit('action:start', {details: {actorId: 'a-1'}});

        expect(calls).toEqual(['first', 'second']);
      });

      it('supports emitting a different event from inside a listener', () => {
        const emitter = createEmitter();
        const calls: string[] = [];

        emitter.on('action:start', () => {
          calls.push('action:start:before');
          emitter.emit('tick');
          calls.push('action:start:after');
        });
        emitter.on('tick', () => {
          calls.push('tick');
        });

        emitter.emit('action:start', {details: {actorId: 'a-1'}});

        expect(calls).toEqual(['action:start:before', 'tick', 'action:start:after']);
      });
    });

    describe('glob patterns', () => {
      it('matches event families with glob patterns', () => {
        const emitter = createEmitter();
        const listener = vi.fn();

        emitter.on('action:*', (event) => {
          expectTypeOf(event.type).toEqualTypeOf<'action:start' | 'action:end'>();
          listener(event.type);
        });

        emitter.emit('action:start', {details: {actorId: 'a-1'}});
        emitter.emit('action:end', {details: {actorId: 'a-1', success: true}});

        expect(listener).toHaveBeenNthCalledWith(1, 'action:start');
        expect(listener).toHaveBeenNthCalledWith(2, 'action:end');
      });

      it('does not call glob listeners that do not match the emitted event', () => {
        const emitter = createEmitter();
        const listener = vi.fn();

        emitter.on('tick', listener);
        emitter.emit('action:start', {details: {actorId: 'a-1'}});

        expect(listener).not.toHaveBeenCalled();
      });

      it('fires multiple matching glob patterns in registration order', () => {
        const emitter = createEmitter();
        const calls: string[] = [];

        emitter.on('action:*', () => {
          calls.push('action:*');
        });
        emitter.on('*:start', () => {
          calls.push('*:start');
        });

        emitter.emit('action:start', {details: {actorId: 'a-1'}});

        expect(calls).toEqual(['action:*', '*:start']);
      });

      it('fires a once glob listener only once and removes it through off', () => {
        const emitter = createEmitter();
        const listener = vi.fn();

        emitter.once('action:*', listener);
        emitter.emit('action:start', {details: {actorId: 'a-1'}});
        emitter.emit('action:end', {details: {actorId: 'a-1', success: true}});

        expect(listener).toHaveBeenCalledTimes(1);

        emitter.off('action:*', listener);
        emitter.emit('action:start', {details: {actorId: 'a-1'}});

        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe('bubbling', () => {
      it('bubbles events through parent emitters in hierarchy order', () => {
        const root = createEmitter();
        const child = createEmitter();
        root.addChild(child);
        const calls: string[] = [];

        root.on('action:start', () => {
          calls.push('root');
        });
        child.on('action:start', () => {
          calls.push('child');
        });

        const event = child.emit('action:start', {details: {actorId: 'a-1'}});

        expect(calls).toEqual(['child', 'root']);
        expect(event.origin).toBe(child);
        expect(event.currentEmitter).toBeNull();
        expect(event.propagationPath()).toEqual([child, root]);
      });

      it('bubbles through multi-level parent chains', () => {
        const root = createEmitter();
        const middle = createEmitter();
        const leaf = createEmitter();
        root.addChild(middle);
        middle.addChild(leaf);
        const calls: string[] = [];

        root.on('action:start', () => {
          calls.push('root');
        });
        middle.on('action:start', () => {
          calls.push('middle');
        });
        leaf.on('action:start', () => {
          calls.push('leaf');
        });

        const event = leaf.emit('action:start', {details: {actorId: 'a-1'}});

        expect(calls).toEqual(['leaf', 'middle', 'root']);
        expect(event.propagationPath()).toEqual([leaf, middle, root]);
      });

      it('does not bubble when bubbles is false', () => {
        const root = createEmitter();
        const child = createEmitter();
        root.addChild(child);
        const rootListener = vi.fn();
        const childListener = vi.fn();

        root.on('action:start', rootListener);
        child.on('action:start', childListener);

        const event = child.emit('action:start', {
          bubbles: false,
          details: {actorId: 'a-1'},
        });

        expect(childListener).toHaveBeenCalledTimes(1);
        expect(rootListener).not.toHaveBeenCalled();
        expect(event.propagationPath()).toEqual([child]);
      });

      it('stops propagation to ancestors without skipping current listeners', () => {
        const root = createEmitter();
        const child = createEmitter();
        root.addChild(child);
        const calls: string[] = [];

        child.on('action:start', (event) => {
          calls.push('first');
          event.stopPropagation();
        });
        child.on('action:start', () => {
          calls.push('second');
        });
        root.on('action:start', () => {
          calls.push('root');
        });

        child.emit('action:start', {details: {actorId: 'a-1'}});

        expect(calls).toEqual(['first', 'second']);
      });

      it('stops remaining listeners on the current emitter with stopImmediatePropagation', () => {
        const root = createEmitter();
        const child = createEmitter();
        root.addChild(child);
        const calls: string[] = [];

        child.on('action:start', (event) => {
          calls.push('first');
          event.stopImmediatePropagation();
        });
        child.on('action:start', () => {
          calls.push('second');
        });
        root.on('action:start', () => {
          calls.push('root');
        });

        child.emit('action:start', {details: {actorId: 'a-1'}});

        expect(calls).toEqual(['first']);
      });

      it('continues bubbling when a listener on a child throws', () => {
        const root = createEmitter();
        const child = createEmitter();
        root.addChild(child);
        const calls: string[] = [];

        child.on('action:start', () => {
          calls.push('child');
          throw new Error('boom');
        });
        root.on('action:start', () => {
          calls.push('root');
        });

        expect(() => {
          child.emit('action:start', {details: {actorId: 'a-1'}});
        }).toThrow('boom');

        expect(calls).toEqual(['child', 'root']);
      });
    });

    describe('parent-child hierarchy', () => {
      it('returns a detach function from addChild that is safe to call repeatedly', () => {
        const root = createEmitter();
        const child = createEmitter();
        const rootListener = vi.fn();
        const detach = root.addChild(child);

        root.on('action:start', rootListener);
        detach();
        child.emit('action:start', {details: {actorId: 'a-1'}});

        expect(rootListener).not.toHaveBeenCalled();
        expect(() => detach()).not.toThrow();
      });

      it('removes children explicitly and ignores non-children', () => {
        const root = createEmitter();
        const child = createEmitter();
        const unrelated = createEmitter();
        root.addChild(child);
        const rootListener = vi.fn();

        root.on('action:start', rootListener);

        expect(() => root.removeChild(unrelated)).not.toThrow();

        root.removeChild(child);
        child.emit('action:start', {details: {actorId: 'a-1'}});

        expect(rootListener).not.toHaveBeenCalled();
      });

      it('automatically detaches from the old parent when reparenting', () => {
        const firstParent = createEmitter();
        const secondParent = createEmitter();
        const child = createEmitter();
        firstParent.addChild(child);

        secondParent.addChild(child);

        const firstListener = vi.fn();
        const secondListener = vi.fn();
        firstParent.on('tick', firstListener);
        secondParent.on('tick', secondListener);
        child.emit('tick');

        expect(firstListener).not.toHaveBeenCalled();
        expect(secondListener).toHaveBeenCalledOnce();
      });

      it('silently accepts adding the same child to the same parent twice', () => {
        const root = createEmitter();
        const child = createEmitter();
        const rootListener = vi.fn();

        root.addChild(child);
        const secondDetach = root.addChild(child);
        root.on('action:start', rootListener);

        child.emit('action:start', {details: {actorId: 'a-1'}});

        expect(rootListener).toHaveBeenCalledTimes(1);

        secondDetach();
        child.emit('action:start', {details: {actorId: 'a-1'}});

        expect(rootListener).toHaveBeenCalledTimes(1);
      });

      it('throws when adding an emitter as its own child', () => {
        const emitter = createEmitter();

        expect(() => {
          emitter.addChild(emitter);
        }).toThrow();
      });

      it('throws when adding a child would create a cycle', () => {
        const root = createEmitter();
        const middle = createEmitter();
        const leaf = createEmitter();
        root.addChild(middle);
        middle.addChild(leaf);

        expect(() => {
          leaf.addChild(root);
        }).toThrow();
      });
    });

    describe('emit(event) overload and identity', () => {
      it('dispatches a pre-constructed branded event and returns the same instance', () => {
        const emitter = createEmitter();
        const event = createEvent('action:start', {details: {actorId: 'a-1'}});

        expect(emitter.emit(event)).toBe(event);
      });

      it('rejects structural look-alikes passed to emit(event)', () => {
        const emitter = createEmitter();
        const lookalike = lookalikeEvent();

        expect(() => {
          emitter.emit(lookalike);
        }).toThrow();
      });

      it('rejects non-branded child emitters passed to addChild', () => {
        const emitter = createEmitter();
        const lookalike = lookalikeEmitter();

        expect(() => {
          emitter.addChild(lookalike);
        }).toThrow();
      });
    });
  });
}

/** Builds an object structurally satisfying the event contract without the brand. */
function lookalikeEvent(): Contract.Event<'action:start', {actorId: string}> {
  return {
    type: 'action:start',
    details: {actorId: 'a-1'},
    bubbles: true,
    origin: null,
    currentEmitter: null,
    propagationStopped: false,
    immediatePropagationStopped: false,
    stopPropagation: () => undefined,
    stopImmediatePropagation: () => undefined,
    propagationPath: () => [],
  };
}

/** Builds an object structurally satisfying the emitter contract without the brand. */
function lookalikeEmitter(): Contract.EventEmitter {
  return {
    on: () => () => undefined,
    once: () => () => undefined,
    off: () => undefined,
    emit: () => lookalikeEvent() as Contract.Event<string, unknown>,
    addChild: () => () => undefined,
    removeChild: () => undefined,
  };
}
